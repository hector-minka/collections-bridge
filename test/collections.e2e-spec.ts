import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe, VersioningType, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as request from 'supertest';
import { CollectionsController } from '../src/collections/collections.controller';
import { CollectionsService } from '../src/collections/services/collections.service';
import configuration from '../src/config/configuration';

/**
 * E2E tests for Collections API: endpoints and request/response shapes.
 * Uses mocked CollectionsService (no Ledger, no DB). Validates HTTP layer and response contracts.
 */
describe('Collections API (e2e)', () => {
  let app: INestApplication;
  let mockCollectionsService: jest.Mocked<CollectionsService>;

  const mockCollection = {
    id: 'uuid-1',
    merchantTxId: '0076570881:FACT-2024-001246',
    anchorHandle: 'QR-123',
    intentHandle: '0076570881:FACT-2024-001246',
    schema: 'qr-code',
    status: 'PENDING',
    createdAt: new Date('2026-02-18T00:16:09Z'),
    updatedAt: new Date('2026-02-18T00:16:09Z'),
  };

  beforeAll(async () => {
    const notFound = new NotFoundException('Collection not found');
    mockCollectionsService = {
      handleAnchorCreated: jest.fn().mockResolvedValue(mockCollection),
      processIntentUpdatedEventAsync: jest.fn().mockResolvedValue(undefined),
      getCollectionByMerchantTxId: jest.fn().mockRejectedValue(notFound),
      getCollectionByAnchorHandle: jest.fn().mockRejectedValue(notFound),
      getCollectionByIntentHandle: jest.fn().mockRejectedValue(notFound),
      getCollections: jest.fn().mockResolvedValue([]),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, load: [configuration] })],
      controllers: [CollectionsController],
      providers: [{ provide: CollectionsService, useValue: mockCollectionsService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    const notFound = new NotFoundException('Collection not found');
    jest.clearAllMocks();
    mockCollectionsService.getCollectionByMerchantTxId.mockRejectedValue(notFound);
    mockCollectionsService.getCollectionByAnchorHandle.mockRejectedValue(notFound);
    mockCollectionsService.getCollectionByIntentHandle.mockRejectedValue(notFound);
    mockCollectionsService.getCollections.mockResolvedValue([]);
    mockCollectionsService.handleAnchorCreated.mockResolvedValue(mockCollection as any);
    mockCollectionsService.processIntentUpdatedEventAsync.mockResolvedValue(undefined);
  });

  describe('POST /api/v1/collections/webhooks/anchor-created', () => {
    const validBody = {
      data: {
        handle: 'evt-1',
        signal: 'anchor-created',
        anchor: {
          data: {
            handle: 'QR-123-abc',
            schema: 'qr-code',
            amount: 10000,
            custom: { paymentReferenceNumber: 'FACT-2024-001246' },
            target: { handle: 'svgs:0076570880@bancoazul.com.co', custom: { merchantCode: '0076570881' } },
            symbol: { handle: 'cop' },
          },
        },
      },
    };

    it('returns 200 and { received: true, signal: "anchor-created" }', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/collections/webhooks/anchor-created')
        .send(validBody)
        .expect(200);

      expect(res.body).toEqual({ received: true, signal: 'anchor-created' });
      expect(mockCollectionsService.handleAnchorCreated).toHaveBeenCalledWith(validBody);
    });

    it('returns 400 when data.anchor is missing', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/collections/webhooks/anchor-created')
        .send({ data: {} })
        .expect(400);

      expect(res.body.message).toContain('anchor');
      expect(mockCollectionsService.handleAnchorCreated).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/collections/webhooks/rtp-fulfillment', () => {
    it('returns 200 and { success: true }', async () => {
      const body = {
        data: {
          signal: 'intent-updated',
          intent: {
            data: { handle: 'rtp-1', claims: [{ target: { custom: { idQR: 'CO.COM.SVB.TRXID123' } } }] },
            meta: { status: 'committed' },
          },
        },
      };

      const res = await request(app.getHttpServer())
        .post('/api/v1/collections/webhooks/rtp-fulfillment')
        .send(body)
        .expect(200);

      expect(res.body).toEqual({ success: true });
      expect(mockCollectionsService.processIntentUpdatedEventAsync).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/collections/merchant-txid/:merchantTxId', () => {
    it('returns 404 when collection does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/collections/merchant-txid/nonexistent')
        .expect(404);
    });

    it('returns 200 and collection shape when found', async () => {
      mockCollectionsService.getCollectionByMerchantTxId.mockResolvedValue(mockCollection as any);
      const res = await request(app.getHttpServer())
        .get('/api/v1/collections/merchant-txid/tx-123')
        .expect(200);
      expect(res.body).toMatchObject({
        id: mockCollection.id,
        merchantTxId: mockCollection.merchantTxId,
        status: mockCollection.status,
      });
    });
  });

  describe('GET /api/v1/collections/anchor/:anchorHandle', () => {
    it('returns 404 when collection does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/collections/anchor/QR-nonexistent')
        .expect(404);
    });
  });

  describe('GET /api/v1/collections/intent/:intentHandle', () => {
    it('returns 404 when collection does not exist', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/collections/intent/0076570881:FACT-999')
        .expect(404);
    });
  });

  describe('GET /api/v1/collections', () => {
    it('returns 200 and array', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/collections')
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('accepts query params status and merchantTxId', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/collections')
        .query({ status: 'PENDING', merchantTxId: 'tx-1' })
        .expect(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(mockCollectionsService.getCollections).toHaveBeenCalledWith({
        status: 'PENDING',
        merchantTxId: 'tx-1',
      });
    });
  });

  describe('Request/Response shapes', () => {
    it('anchor-created response has received and signal', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/collections/webhooks/anchor-created')
        .send({
          data: {
            anchor: {
              data: {
                handle: 'QR-shape',
                schema: 'qr-code',
                amount: 100,
                custom: { paymentReferenceNumber: 'REF-1' },
                target: { handle: 't', custom: { merchantCode: '007' } },
                symbol: { handle: 'cop' },
              },
            },
          },
        })
        .expect(200);
      expect(res.body).toHaveProperty('received', true);
      expect(res.body).toHaveProperty('signal', 'anchor-created');
    });

    it('rtp-fulfillment response has success', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/collections/webhooks/rtp-fulfillment')
        .send({
          data: {
            intent: {
              data: { claims: [] },
              meta: { status: 'prepared' },
            },
          },
        })
        .expect(200);
      expect(res.body).toHaveProperty('success', true);
    });
  });
});
