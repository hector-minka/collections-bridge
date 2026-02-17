import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CollectionEntity } from '../entities/collection.entity';
import { LedgerService } from './ledger.service';
import { AnchorCreatedEventDto } from '../dto/anchor-created-event.dto';
import { IntentUpdatedEventDto } from '../dto/intent-updated-event.dto';

/**
 * Main service for Payment Collections operations
 */
@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(
    @InjectRepository(CollectionEntity)
    private collectionRepository: Repository<CollectionEntity>,
    private ledgerService: LedgerService,
  ) {}

  /**
   * Handle anchor_created event from Payments Hub
   * Flow 2: Intent Generation (Idempotent by merchantTxId)
   */
  async handleAnchorCreated(
    event: AnchorCreatedEventDto,
  ): Promise<CollectionEntity> {
    this.logger.log('=== PROCESSING: anchor_created event ===');
    this.logger.log(`Event data: ${JSON.stringify(event, null, 2)}`);

    try {
      // Extract anchor handle from the event structure
      // The ledger sends: data.anchor.data.handle
      const anchorHandle = event.data?.anchor?.data?.handle;
      this.logger.log(`Extracted anchor handle: ${anchorHandle}`);

      if (!anchorHandle) {
        throw new Error('Anchor handle not found in event data');
      }

      // Use anchor data directly from the webhook (it's already complete)
      // No need to fetch from ledger again
      const anchor = event.data?.anchor;
      this.logger.log(`Using anchor data from webhook: ${JSON.stringify(anchor, null, 2)}`);

      if (!anchor) {
        throw new Error('Anchor data not found in event');
      }

      // Intent handle: merchantCode + ":" + paymentReferenceNumber
      // merchantCode from target.custom.merchantCode (e.g. "0076570880"); paymentReferenceNumber from custom (e.g. "FACT-2024-001234")
      const target = anchor.data?.target as
        | string
        | { handle?: string; custom?: { merchantCode?: string }; merchantCode?: string }
        | undefined;
      const merchantCodeRaw =
        (typeof target === 'object' && target !== null && (target?.custom?.merchantCode ?? target?.merchantCode)) ||
        (typeof target === 'string' ? target : null) ||
        null;
      const merchantCode = typeof merchantCodeRaw === 'string' ? merchantCodeRaw : null;
      const paymentReferenceNumber = anchor.data?.custom?.paymentReferenceNumber;
      if (!merchantCode || !paymentReferenceNumber) {
        throw new Error(
          'Anchor must have target.custom.merchantCode (or target.merchantCode) and custom.paymentReferenceNumber to derive intent handle',
        );
      }
      const intentHandleFromAnchor = `${merchantCode}:${paymentReferenceNumber}`;
      this.logger.log(`Intent handle (merchantCode:paymentReferenceNumber): ${intentHandleFromAnchor}`);

      // merchantTxId for collection/backwards compatibility (metadata or fallback)
      let merchantTxId =
        anchor.data?.custom?.metadata?.merchantTxId ||
        event.data?.anchor?.data?.custom?.metadata?.merchantTxId;
      if (!merchantTxId) {
        merchantTxId = intentHandleFromAnchor;
        this.logger.warn(
          `merchantTxId not in anchor metadata, using intent handle as merchantTxId: ${merchantTxId}`,
        );
      }
      this.logger.log(`Using merchantTxId: ${merchantTxId}`);

      const schema = anchor.data?.schema || event.data?.anchor?.data?.schema || null;
      this.logger.log(`Extracted schema: ${schema}`);

      // Claim target: anchor.target as handle (string or target.handle)
      const rawTarget = anchor.data?.target;
      const claimTargetHandle =
        typeof rawTarget === 'string'
          ? rawTarget
          : (rawTarget as { handle?: string } | undefined)?.handle ?? null;
      if (!claimTargetHandle) {
        throw new Error(
          'Anchor must have target (string handle or object with handle) for intent claim',
        );
      }
      // symbol can be object { handle: 'cop' } or string
      const rawSymbol =
        anchor.data?.symbol ?? event.data?.anchor?.data?.symbol ?? null;
      const symbolHandle =
        rawSymbol != null && typeof rawSymbol === 'object' && 'handle' in rawSymbol
          ? (rawSymbol as { handle: string }).handle
          : typeof rawSymbol === 'string'
            ? rawSymbol
            : null;
      const amount =
        anchor.data?.amount ?? event.data?.anchor?.data?.amount ?? null;
      if (symbolHandle == null || amount == null) {
        throw new Error(
          'Anchor must have data.symbol (or symbol.handle) and data.amount for intent claim',
        );
      }

      // Check if collection already exists
      this.logger.log(`Checking for existing collection with merchantTxId: ${merchantTxId}`);
      let collection = await this.collectionRepository.findOne({
        where: { merchantTxId },
      });

      if (!collection) {
        this.logger.log('Collection does not exist, creating new one');
        // Create new collection record
        collection = this.collectionRepository.create({
          merchantTxId,
          anchorHandle: anchorHandle,
          schema: schema || undefined,
          status: 'PENDING',
          anchorData: anchor as Record<string, any>,
        });
        await this.collectionRepository.save(collection);
        this.logger.log(`Collection created: ${JSON.stringify(collection, null, 2)}`);
      } else {
        this.logger.log('Collection exists, updating with new anchor');
        // Update existing collection with new anchor
        collection.anchorHandle = anchorHandle;
        collection.anchorData = anchor as Record<string, any>;
        if (!collection.schema && schema) {
          collection.schema = schema;
        }
        await this.collectionRepository.save(collection);
        this.logger.log(`Collection updated: ${JSON.stringify(collection, null, 2)}`);
      }

      // Check if intent already exists by handle; if so, add this anchor as label. Else create.
      this.logger.log(`Checking for existing intent with handle: ${intentHandleFromAnchor}`);
      let intent = await this.ledgerService.getIntent(intentHandleFromAnchor).catch(() => null);

      if (intent) {
        this.logger.log(
          `Intent already exists (handle: ${intentHandleFromAnchor}), adding anchor label`,
        );
        await this.ledgerService.addAnchorLabelToIntent(
          intentHandleFromAnchor,
          anchorHandle,
          schema || 'unknown',
        );
        intent = await this.ledgerService.getIntent(intentHandleFromAnchor);
      } else {
        try {
          this.logger.log(`Creating new intent with handle: ${intentHandleFromAnchor}`);
          intent = await this.ledgerService.createIntent({
            handle: intentHandleFromAnchor,
            anchorHandle,
            anchorSchema: schema || 'payment-collection',
            claimTargetHandle,
            symbolHandle: String(symbolHandle),
            amount: Number(amount),
            merchantTxId,
          });
          const responseData = intent?.data || intent;
          intent = responseData?.data ? { data: responseData } : intent;
          this.logger.log(`Intent created: ${JSON.stringify(intent, null, 2)}`);
        } catch (createErr: any) {
          const isDuplicate =
            createErr?.status === 409 ||
            createErr?.reason === 'CONFLICT' ||
            /duplicate|already exists|conflict/i.test(createErr?.message || '');
          if (isDuplicate) {
            this.logger.log(
              `Duplicate intent for handle ${intentHandleFromAnchor}, adding anchor label`,
            );
            await this.ledgerService.addAnchorLabelToIntent(
              intentHandleFromAnchor,
              anchorHandle,
              schema || 'unknown',
            );
            intent = await this.ledgerService.getIntent(intentHandleFromAnchor);
          } else {
            throw createErr;
          }
        }
      }

      const intentHandle =
        intent?.data?.handle ?? intent?.data?.data?.handle ?? (intent as any)?.handle ?? intentHandleFromAnchor;
      this.logger.log(`Anchor ${anchorHandle} linked to intent ${intentHandle} (local only; we do not modify the anchor in the Ledger)`);

      // Update collection with intent info (we do not update the anchor in the Ledger)
      collection.intentHandle = intentHandle;
      collection.intentData = intent;
      await this.collectionRepository.save(collection);
      this.logger.log(`Collection updated with intent info: ${JSON.stringify(collection, null, 2)}`);

      this.logger.log(
        `Successfully linked anchor ${anchorHandle} to intent ${intentHandle}`,
      );
      this.logger.log('=== COMPLETED: anchor_created event processing ===');

      return collection;
    } catch (error) {
      this.logger.error(
        `Error handling anchor_created event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Runs asynchronously after the webhook has already responded with success.
   * Logs the full request; later can do submitProof + DB update.
   * Errors are caught and logged so they do not become unhandled rejections.
   */
  async processIntentUpdatedEventAsync(
    body: Record<string, unknown>,
    meta: {
      method: string;
      url: string;
      path: string;
      ip?: string;
      headers: Record<string, unknown>;
      query: Record<string, unknown>;
    },
  ): Promise<void> {
    const fullRequestLog = {
      _comment: 'RTP fulfillment webhook - async processing',
      timestamp: new Date().toISOString(),
      ...meta,
      body,
      bodyKeys: body ? Object.keys(body) : [],
    };
    this.logger.log('=== RTP WEBHOOK ASYNC: full request ===');
    this.logger.log(JSON.stringify(fullRequestLog, null, 2));
    this.logger.log('=== END RTP WEBHOOK ASYNC ===');

    const intentHandle = (body?.data as any)?.intent?.data?.handle;
    const signal = (body?.data as any)?.signal;
    this.logger.log(
      `Event summary: signal=${signal ?? 'n/a'}, intentHandle=${intentHandle ?? 'n/a'}`,
    );

    // TODO: submitProof + update collection to COMPLETED when ready
  }

  /**
   * Get collection by merchantTxId
   */
  async getCollectionByMerchantTxId(
    merchantTxId: string,
  ): Promise<CollectionEntity> {
    const collection = await this.collectionRepository.findOne({
      where: { merchantTxId },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection not found for merchantTxId: ${merchantTxId}`,
      );
    }

    return collection;
  }

  /**
   * Get collection by anchor handle
   */
  async getCollectionByAnchorHandle(
    anchorHandle: string,
  ): Promise<CollectionEntity> {
    const collection = await this.collectionRepository.findOne({
      where: { anchorHandle },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection not found for anchorHandle: ${anchorHandle}`,
      );
    }

    return collection;
  }

  /**
   * Get collection by intent handle
   */
  async getCollectionByIntentHandle(
    intentHandle: string,
  ): Promise<CollectionEntity> {
    const collection = await this.collectionRepository.findOne({
      where: { intentHandle },
    });

    if (!collection) {
      throw new NotFoundException(
        `Collection not found for intentHandle: ${intentHandle}`,
      );
    }

    return collection;
  }

  /**
   * Get all collections with optional filters
   */
  async getCollections(filters?: {
    status?: string;
    merchantTxId?: string;
  }): Promise<CollectionEntity[]> {
    const query = this.collectionRepository.createQueryBuilder('collection');

    if (filters?.status) {
      query.andWhere('collection.status = :status', { status: filters.status });
    }

    if (filters?.merchantTxId) {
      query.andWhere('collection.merchantTxId = :merchantTxId', {
        merchantTxId: filters.merchantTxId,
      });
    }

    return query.orderBy('collection.createdAt', 'DESC').getMany();
  }
}
