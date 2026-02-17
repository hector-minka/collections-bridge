import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LedgerSdk } from '@minka/ledger-sdk';
import { generateSignature } from '../../../crypto-utils';

/**
 * Service for interacting with Minka Ledger SDK
 */
@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);
  private sdk: LedgerSdk;

  constructor(private configService: ConfigService) {
    this.initializeSdk();
  }

  private initializeSdk() {
    const config = this.configService.get('minka');
    const signerConfig = config.signer;

    this.sdk = new LedgerSdk({
      ledger: config.ledger.ledger,
      server: config.ledger.server,
      signer: {
        format: signerConfig.format,
        public: signerConfig.public,
      },
      secure: {
        iss: signerConfig.public,
        sub: `signer:${signerConfig.public}`,
        aud: config.ledger.ledger,
        exp: 60,
        keyPair: {
          format: signerConfig.format,
          public: signerConfig.public,
          secret: signerConfig.secret,
        },
      },
    });

    this.logger.log('Ledger SDK initialized');
  }

  /**
   * Get anchor by handle (uses SDK read() which encodes the handle in the path).
   */
  async getAnchor(handle: string): Promise<any> {
    try {
      const anchorResponse = await this.sdk.anchor.read(handle);
      const record = (anchorResponse as any).response?.data ?? anchorResponse;
      return record;
    } catch (error) {
      this.logger.error(`Error getting anchor ${handle}:`, error);
      throw error;
    }
  }

  /**
   * Get anchor by label
   */
  async getAnchorByLabel(key: string, value: string): Promise<any> {
    try {
      const response = await (this.sdk.anchor as any).list({
        'meta.labels': `${key}:${value}`,
      });
      const listData = response?.data || response;
      const items = listData?.list || listData?.items || [];
      return items[0] || null;
    } catch (error) {
      this.logger.error(`Error getting anchor by label ${key}:${value}:`, error);
      throw error;
    }
  }

  /**
   * Update anchor (e.g., to add intentHandle and labels). Uses SDK anchor.read() and anchor.from(record).data().meta().hash().sign().send().
   */
  async updateAnchor(
    handle: string,
    updates: {
      custom?: Record<string, any>;
      labels?: string[];
    },
  ): Promise<any> {
    try {
      const config = this.configService.get('minka');
      const signatureCustom = {
        moment: new Date().toISOString(),
        status: 'UPDATED' as const,
      };

      const currentAnchor = await this.getAnchor(handle);
      const anchorData = currentAnchor.data || currentAnchor;
      const updateData = {
        ...anchorData,
        custom: {
          ...anchorData.custom,
          ...updates.custom,
        },
      };

      const anchorMeta = currentAnchor.meta || currentAnchor;
      const existingLabels = anchorMeta.labels || [];
      const newLabels = updates.labels || [];
      const mergedLabels = [
        ...existingLabels,
        ...newLabels.filter(
          (label: string) => !existingLabels.some((existing: string) => existing === label),
        ),
      ];

      const { response } = await this.sdk.anchor
        .from(currentAnchor)
        .data(updateData)
        .meta({ labels: mergedLabels, proofs: [] })
        .hash()
        .sign([
          {
            keyPair: {
              format: config.signer.format,
              public: config.signer.public,
              secret: config.signer.secret,
            },
            custom: signatureCustom,
          },
        ])
        .send();

      return response;
    } catch (error) {
      this.logger.error(`Error updating anchor ${handle}:`, error);
      throw error;
    }
  }

  /**
   * Get intent by merchantTxId
   */
  async getIntentByMerchantTxId(merchantTxId: string): Promise<any> {
    try {
      const response = await (this.sdk.intent as any).list({
        'meta.labels': `merchant-txid:${merchantTxId}`,
      });
      const listData = response?.data || response;
      const items = listData?.list || listData?.items || [];
      // Find intent with matching merchantTxId in custom
      const intent = items.find(
        (item: any) => {
          const itemData = item.data || item;
          return itemData?.custom?.merchantTxId === merchantTxId;
        },
      );
      return intent || null;
    } catch (error) {
      this.logger.error(
        `Error getting intent by merchantTxId ${merchantTxId}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Create intent with explicit handle, claims, and access.
   * Schema: "payment-collection". Claim source from config (INTENT_CLAIM_SOURCE_HANDLE). Target/symbol/amount from anchor.
   */
  async createIntent(data: {
    handle: string;
    anchorHandle: string;
    anchorSchema: string;
    claimTargetHandle: string;
    symbolHandle: string;
    amount: number;
    merchantTxId?: string;
    custom?: Record<string, any>;
  }): Promise<any> {
    const config = this.configService.get('minka');
    const signatureCustom = {
      moment: new Date().toISOString(),
      status: 'CREATED',
    };

    const intentSchema = 'payment-collection';
    const anchorLabel = `${data.anchorHandle}:${data.anchorSchema}`;
    const claimSourceHandle =
      this.configService.get<string>('minka.intentClaimSourceHandle') || 'servibanca';
    const handle = data.handle;

    const intentData: any = {
      handle,
      schema: intentSchema,
      claims: [
        {
          action: 'transfer',
          source: { handle: claimSourceHandle },
          target: { handle: data.claimTargetHandle },
          symbol: { handle: data.symbolHandle },
          amount: data.amount,
        },
      ],
      access: [
        {
          action: 'any',
          signer: { public: config.signer.public },
        },
      ],
    };
    const custom: Record<string, any> = { ...(data.custom || {}) };
    if (data.merchantTxId) custom.merchantTxId = data.merchantTxId;
    if (Object.keys(custom).length > 0) intentData.custom = custom;

    const labels: string[] = [anchorLabel];

    try {
      const { digest, result } = generateSignature(
        intentData,
        config.signer.secret,
        signatureCustom,
      );

      const { response } = await this.sdk.intent
        .init()
        .data(intentData)
        .meta({
          labels,
          proofs: [
            {
              method: 'ed25519-v2',
              custom: signatureCustom,
              digest,
              public: config.signer.public,
              result,
            },
          ],
        })
        .hash()
        .sign([
          {
            keyPair: {
              format: config.signer.format,
              public: config.signer.public,
              secret: config.signer.secret,
            },
            custom: signatureCustom,
          },
        ])
        .send();

      const responseData = response?.data || response;
      const intentHandle = responseData?.data?.handle || (responseData as any)?.handle;
      this.logger.log(`Intent created: ${intentHandle}`);
      return response;
    } catch (error: any) {
      this.logger.error(`Error creating intent:`, error);
      this.logger.error(`Error details:`, {
        message: error.message,
        reason: error.reason,
        detail: error.detail,
        custom: error.custom,
        stack: error.stack,
      });
      this.logger.error(`Intent data that failed:`, JSON.stringify(intentData, null, 2));
      if (error?.reason === 'record.relation-not-found') {
        this.logger.error(
          `Ledger returned record.relation-not-found: one of these handles does not exist in the Ledger. ` +
            `Ensure the following records exist: source="${intentData.claims?.[0]?.source?.handle}", ` +
            `target="${intentData.claims?.[0]?.target?.handle}", symbol="${intentData.claims?.[0]?.symbol?.handle}". ` +
            `Set INTENT_CLAIM_SOURCE_HANDLE to your wallet/account handle if needed.`,
        );
      }
      throw error;
    }
  }

  /**
   * Add an anchor label to an existing intent (e.g. when duplicate intent on create).
   * Uses SDK intent.from(record).hash().sign().send() to POST a proof with
   * custom.labels.$addToSet = "<anchor-handle>:<anchor-schema>"
   */
  async addAnchorLabelToIntent(
    intentHandle: string,
    anchorHandle: string,
    anchorSchema: string,
  ): Promise<any> {
    const config = this.configService.get('minka');
    const anchorLabel = `${anchorHandle}:${anchorSchema}`;
    const signatureCustom = {
      moment: new Date().toISOString(),
      labels: {
        $addToSet: anchorLabel,
      },
    };

    try {
      const intentResponse = await this.sdk.intent.read(intentHandle);
      const record = (intentResponse as any).response?.data;
      if (!record) {
        throw new Error('Intent record not found in response');
      }
      const { response } = await this.sdk.intent
        .from(record)
        .hash()
        .sign([
          {
            keyPair: {
              format: config.signer.format,
              public: config.signer.public,
              secret: config.signer.secret,
            },
            custom: signatureCustom,
          },
        ])
        .send();
      this.logger.log(`Added anchor label to intent ${intentHandle}: ${anchorLabel}`);
      return response;
    } catch (error) {
      this.logger.error(
        `Error adding anchor label to intent ${intentHandle}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Submit proof to intent (evidence/committed). Uses SDK intent.from(record).hash().sign().send().
   */
  async submitProof(
    intentHandle: string,
    evidence: Record<string, any>,
  ): Promise<any> {
    try {
      const config = this.configService.get('minka');
      const signatureCustom = {
        moment: new Date().toISOString(),
        status: 'committed' as const,
        evidence,
      };

      const intentResponse = await this.sdk.intent.read(intentHandle);
      const record = (intentResponse as any).response?.data;
      if (!record) {
        throw new Error('Intent record not found in response');
      }
      const { response } = await this.sdk.intent
        .from(record)
        .hash()
        .sign([
          {
            keyPair: {
              format: config.signer.format,
              public: config.signer.public,
              secret: config.signer.secret,
            },
            custom: signatureCustom,
          },
        ])
        .send();

      this.logger.log(`Proof submitted to intent ${intentHandle}`);
      return response;
    } catch (error) {
      this.logger.error(`Error submitting proof to intent ${intentHandle}:`, error);
      throw error;
    }
  }

  /**
   * Get intent by handle (uses SDK read() which encodes the handle in the path).
   */
  async getIntent(handle: string): Promise<any> {
    try {
      const intentResponse = await this.sdk.intent.read(handle);
      const record = (intentResponse as any).response?.data ?? intentResponse;
      return record;
    } catch (error) {
      this.logger.error(`Error getting intent ${handle}:`, error);
      throw error;
    }
  }
}
