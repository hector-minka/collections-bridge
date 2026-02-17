import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LedgerSdk } from '@minka/ledger-sdk';
import { generateSignature, signJWT } from '../../../crypto-utils';

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
   * Search for anchor by paymentId (idQR) using direct HTTP GET with x-schema: qr-code.
   * The SDK list() does not reliably send that header; this matches the working request.
   */
  private async findAnchorByPaymentIdDirectRequest(paymentId: string): Promise<any> {
    const config = this.configService.get('minka');
    const server = config.ledger.server?.replace(/\/$/, '');
    const ledger = config.ledger.ledger;
    if (!server || !ledger) {
      this.logger.warn('Ledger server or name not configured, skipping direct anchor search');
      return null;
    }
    const now = Math.floor(Date.now() / 1000);
    const jwt = await signJWT(
      {
        iss: config.signer.public,
        sub: `signer:${config.signer.public}`,
        aud: ledger,
        iat: now,
        exp: now + 60,
      },
      config.signer.secret,
      config.signer.public,
    );
    const iso = new Date().toISOString();
    const url = new URL(`${server}/anchors`);
    url.searchParams.set('data.custom.paymentId', paymentId);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-ledger': ledger,
        Authorization: `Bearer ${jwt}`,
        'x-received': iso,
        'x-dispatched': iso,
        'x-schema': 'qr-code',
      },
    });
    if (!res.ok) {
      this.logger.warn(`Direct anchor search failed: ${res.status} ${res.statusText}`);
      return null;
    }
    const body = await res.json();
    const anchors = body?.data ?? body?.list ?? [];
    const items = Array.isArray(anchors) ? anchors : [];
    if (items.length > 0) {
      this.logger.log(`Found anchor by paymentId (direct request): ${items[0]?.data?.handle ?? items[0]?.handle}`);
      return items[0];
    }
    return null;
  }

  /**
   * Search for anchor by idQR (which maps to custom.paymentId) or aliasValue on payment-initiation-demo ledger.
   * - For QR: direct HTTP GET with x-schema: qr-code (paymentId).
   * - For alias (dynamic-key): aliasValue is the anchor handle, so we use sdk.anchor.read(aliasValue).
   */
  async findAnchorByIdQROrAliasValue(
    idQR?: string,
    aliasValue?: string,
  ): Promise<any> {
    try {
      if (!idQR && !aliasValue) {
        throw new Error('Either idQR or aliasValue must be provided');
      }

      // Search by idQR (paymentId) via direct request so x-schema: qr-code is sent
      if (idQR) {
        this.logger.log(`Searching anchor by idQR (paymentId): ${idQR}`);
        const anchor = await this.findAnchorByPaymentIdDirectRequest(idQR);
        if (anchor) return anchor;
      }

      // For aliasValue (dynamic-key): the value is the anchor handle — read by handle
      if (aliasValue) {
        this.logger.log(`Reading anchor by handle (aliasValue / dynamic-key): ${aliasValue}`);
        try {
          const anchorResponse = await this.sdk.anchor.read(aliasValue);
          const record = (anchorResponse as any).response?.data ?? anchorResponse;
          if (record?.data?.handle ?? record?.handle) {
            this.logger.log(`Found anchor by handle: ${record?.data?.handle ?? record?.handle}`);
            return record;
          }
        } catch (readErr: any) {
          if (readErr?.response?.status === 404 || readErr?.code === 'ERR_BAD_REQUEST') {
            this.logger.warn(`Anchor not found by handle: ${aliasValue}`);
          } else {
            throw readErr;
          }
        }
      }

      this.logger.warn(`No anchor found for idQR/paymentId=${idQR}, aliasValue=${aliasValue}`);
      return null;
    } catch (error) {
      this.logger.error(
        `Error finding anchor by idQR/aliasValue (idQR=${idQR}, aliasValue=${aliasValue}):`,
        error,
      );
      throw error;
    }
  }

  /**
   * Get intent by merchantcode and paymentReferenceNumber
   * Intent handle format: merchantcode:paymentReferenceNumber
   */
  async getIntentByMerchantCodeAndPaymentReference(
    merchantCode: string,
    paymentReferenceNumber: string,
  ): Promise<any> {
    try {
      const intentHandle = `${merchantCode}:${paymentReferenceNumber}`;
      this.logger.log(
        `Getting intent by handle: ${intentHandle} (merchantCode: ${merchantCode}, paymentReferenceNumber: ${paymentReferenceNumber})`,
      );
      return await this.getIntent(intentHandle);
    } catch (error) {
      this.logger.error(
        `Error getting intent by merchantCode/paymentReference (merchantCode=${merchantCode}, paymentReferenceNumber=${paymentReferenceNumber}):`,
        error,
      );
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
   * Returns true if the intent already has a proof with status "committed" from our signer.
   * Used to make RTP fulfillment idempotent when multiple intent-updated events are received.
   */
  async intentHasCommittedProofFromUs(intentHandle: string): Promise<boolean> {
    try {
      const config = this.configService.get('minka');
      const record = await this.getIntent(intentHandle);
      const proofs = record?.meta?.proofs ?? [];
      const ourPublic = config.signer.public;
      return proofs.some(
        (p: any) =>
          p?.public === ourPublic && p?.custom?.status === 'committed',
      );
    } catch {
      return false;
    }
  }

  /**
   * Submit proof to intent (detail/committed). Uses SDK intent.from(record).hash().sign().send().
   */
  async submitProof(
    intentHandle: string,
    detail: Record<string, any>,
  ): Promise<any> {
    try {
      const config = this.configService.get('minka');
      // IntentProofCustom.detail is typed as string in the SDK; serialize object to JSON
      // coreId = RTP intent handle for Payments Hub standard in reports
      const signatureCustom = {
        moment: new Date().toISOString(),
        status: 'committed' as const,
        detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
        ...(detail?.rtpIntentHandle && { coreId: detail.rtpIntentHandle }),
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

  /**
   * Extract anchor handles from intent meta.labels. Labels are stored as "anchorHandle:schema" (e.g. "QR-xxx:qr-code").
   * Skips non-anchor labels like "merchant-txid:...".
   */
  getAnchorHandlesFromIntentLabels(intentRecord: any): string[] {
    const labels = intentRecord?.meta?.labels ?? intentRecord?.labels ?? [];
    const handles: string[] = [];
    for (const label of Array.isArray(labels) ? labels : []) {
      const s = typeof label === 'string' ? label : String(label);
      const idx = s.indexOf(':');
      if (idx > 0) {
        const handle = s.slice(0, idx).trim();
        if (handle && handle !== 'merchant-txid') handles.push(handle);
      }
    }
    return [...new Set(handles)];
  }

  /**
   * Returns true if the anchor already has a proof with the given status from our signer.
   * Used to make anchor status updates idempotent when the webhook is retried or called multiple times.
   */
  async anchorHasProofFromUs(
    anchorHandle: string,
    status: 'COMPLETED' | 'CANCELLED',
  ): Promise<boolean> {
    try {
      const config = this.configService.get('minka');
      const record = await this.getAnchor(anchorHandle);
      const proofs = record?.meta?.proofs ?? [];
      const ourPublic = config.signer.public;
      return proofs.some(
        (p: any) => p?.public === ourPublic && p?.custom?.status === status,
      );
    } catch {
      return false;
    }
  }

  /**
   * Add a proof to an anchor (e.g. COMPLETED or CANCELLED). Uses SDK anchor.from(record).hash().sign().send().
   */
  async addProofToAnchor(
    anchorHandle: string,
    custom: {
      moment: string;
      status: 'COMPLETED' | 'CANCELLED';
      reason: string;
      paymentReference: string;
    },
  ): Promise<any> {
    try {
      const config = this.configService.get('minka');
      const record = await this.getAnchor(anchorHandle);
      if (!record?.data?.handle) {
        throw new Error(`Anchor record missing data.handle for ${anchorHandle}`);
      }

      const { response } = await this.sdk.anchor
        .from(record)
        .hash()
        .sign([
          {
            keyPair: {
              format: config.signer.format,
              public: config.signer.public,
              secret: config.signer.secret,
            },
            custom: {
              moment: custom.moment,
              status: custom.status,
              reason: custom.reason,
              paymentReference: custom.paymentReference,
            },
          },
        ])
        .send();

      this.logger.log(`Proof added to anchor ${anchorHandle}: status=${custom.status}`);
      return response;
    } catch (error) {
      this.logger.error(`Error adding proof to anchor ${anchorHandle}:`, error);
      throw error;
    }
  }
}
