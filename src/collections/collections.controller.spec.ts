import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './services/collections.service';
import { CollectionEntity } from './entities/collection.entity';

describe('CollectionsController', () => {
  let controller: CollectionsController;
  let service: jest.Mocked<CollectionsService>;

  const mockCollection: Partial<CollectionEntity> = {
    id: 'uuid-1',
    merchantTxId: '0076570881:FACT-2024-001246',
    anchorHandle: 'QR-1771373768504-371gz8',
    intentHandle: '0076570881:FACT-2024-001246',
    schema: 'qr-code',
    status: 'PENDING',
    createdAt: new Date('2026-02-18T00:16:09Z'),
    updatedAt: new Date('2026-02-18T00:16:09Z'),
  };

  beforeEach(async () => {
    const mockCollectionsService = {
      handleAnchorCreated: jest.fn().mockResolvedValue(mockCollection),
      processIntentUpdatedEventAsync: jest.fn().mockResolvedValue(undefined),
      getCollectionByMerchantTxId: jest.fn().mockResolvedValue(mockCollection),
      getCollectionByAnchorHandle: jest.fn().mockResolvedValue(mockCollection),
      getCollectionByIntentHandle: jest.fn().mockResolvedValue(mockCollection),
      getCollections: jest.fn().mockResolvedValue([mockCollection]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CollectionsController],
      providers: [
        {
          provide: CollectionsService,
          useValue: mockCollectionsService,
        },
      ],
    }).compile();

    controller = module.get<CollectionsController>(CollectionsController);
    service = module.get(CollectionsService) as jest.Mocked<CollectionsService>;
    jest.clearAllMocks();
  });

  describe('POST /collections/webhooks/anchor-created', () => {
    const validAnchorCreatedBody = {
      data: {
        handle: 'evt-123',
        signal: 'anchor-created',
        anchor: {
          data: {
            handle: 'QR-1771373768504-371gz8',
            schema: 'qr-code',
            amount: 10000,
            custom: { paymentReferenceNumber: 'FACT-2024-001246' },
            target: { handle: 'svgs:0076570880@bancoazul.com.co', custom: { merchantCode: '0076570881' } },
            symbol: { handle: 'cop' },
          },
        },
      },
    };

    it('returns 200 and { received: true, signal: "anchor-created" } when event has data.anchor', async () => {
      const req = { body: validAnchorCreatedBody, url: '/api/v1/collections/webhooks/anchor-created' } as any;
      const result = await controller.handleAnchorCreated(validAnchorCreatedBody as any, req);
      expect(result).toEqual({ received: true, signal: 'anchor-created' });
      expect(service.handleAnchorCreated).toHaveBeenCalledWith(validAnchorCreatedBody);
    });

    it('throws BadRequestException when data.anchor is missing', async () => {
      const invalidBody = { data: { handle: 'evt-1' } };
      await expect(
        controller.handleAnchorCreated(invalidBody as any, {} as any),
      ).rejects.toThrow(BadRequestException);
      expect(service.handleAnchorCreated).not.toHaveBeenCalled();
    });

    it('accepts event and processes async without awaiting', async () => {
      const req = { body: validAnchorCreatedBody, url: '/api/v1/collections/webhooks/anchor-created' } as any;
      await controller.handleAnchorCreated(validAnchorCreatedBody as any, req);
      await new Promise((r) => setImmediate(r));
      expect(service.handleAnchorCreated).toHaveBeenCalledTimes(1);
    });
  });

  describe('POST /collections/webhooks/rtp-fulfillment', () => {
    const validRtpBody = {
      data: {
        signal: 'intent-updated',
        intent: {
          data: { handle: '20260217901383474SRV320233765380823', claims: [{ target: { custom: { idQR: 'CO.COM.SVB.TRXID123' } } }] },
          meta: { status: 'committed' },
        },
      },
    };

    it('returns 200 and { success: true } immediately', async () => {
      const req = {
        body: validRtpBody,
        method: 'POST',
        url: '/api/v1/collections/webhooks/rtp-fulfillment',
        path: '/api/v1/collections/webhooks/rtp-fulfillment',
        ip: '127.0.0.1',
        headers: {},
        query: {},
        socket: {},
      } as any;
      const result = await controller.handleRtpWebhook(validRtpBody as any, req);
      expect(result).toEqual({ success: true });
    });

    it('calls processIntentUpdatedEventAsync with body and meta (async)', async () => {
      const req = {
        body: validRtpBody,
        method: 'POST',
        url: '/api/v1/collections/webhooks/rtp-fulfillment',
        path: '/path',
        headers: {},
        query: {},
      } as any;
      await controller.handleRtpWebhook(validRtpBody as any, req);
      await new Promise((r) => setImmediate(r));
      expect(service.processIntentUpdatedEventAsync).toHaveBeenCalledWith(
        validRtpBody,
        expect.objectContaining({
          method: 'POST',
          url: '/api/v1/collections/webhooks/rtp-fulfillment',
          path: '/path',
        }),
      );
    });
  });

  describe('GET /collections/merchant-txid/:merchantTxId', () => {
    it('returns collection and 200 when found', async () => {
      const result = await controller.getByMerchantTxId('0076570881:FACT-2024-001246', {} as any);
      expect(result).toMatchObject({
        id: mockCollection.id,
        merchantTxId: mockCollection.merchantTxId,
        anchorHandle: mockCollection.anchorHandle,
        status: mockCollection.status,
      });
      expect(service.getCollectionByMerchantTxId).toHaveBeenCalledWith('0076570881:FACT-2024-001246');
    });

    it('throws NotFoundException when service throws', async () => {
      service.getCollectionByMerchantTxId.mockRejectedValue(new NotFoundException('Collection not found'));
      await expect(controller.getByMerchantTxId('nonexistent', {} as any)).rejects.toThrow(NotFoundException);
    });
  });

  describe('GET /collections/anchor/:anchorHandle', () => {
    it('returns collection when found', async () => {
      const result = await controller.getByAnchorHandle('QR-1771373768504-371gz8', {} as any);
      expect(result).toMatchObject({ anchorHandle: 'QR-1771373768504-371gz8' });
      expect(service.getCollectionByAnchorHandle).toHaveBeenCalledWith('QR-1771373768504-371gz8');
    });
  });

  describe('GET /collections/intent/:intentHandle', () => {
    it('returns collection when found', async () => {
      const result = await controller.getByIntentHandle('0076570881:FACT-2024-001246', {} as any);
      expect(result).toMatchObject({ intentHandle: '0076570881:FACT-2024-001246' });
      expect(service.getCollectionByIntentHandle).toHaveBeenCalledWith('0076570881:FACT-2024-001246');
    });
  });

  describe('GET /collections', () => {
    it('returns array of collections and passes query params', async () => {
      const result = await controller.getCollections(
        { method: 'GET', url: '/api/v1/collections', headers: {} } as any,
        'PENDING',
        'tx-123',
      );
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]).toMatchObject({ status: 'PENDING' });
      expect(service.getCollections).toHaveBeenCalledWith({ status: 'PENDING', merchantTxId: 'tx-123' });
    });

    it('calls getCollections with no filters when no query', async () => {
      await controller.getCollections({} as any, undefined, undefined);
      expect(service.getCollections).toHaveBeenCalledWith({});
    });
  });
});
