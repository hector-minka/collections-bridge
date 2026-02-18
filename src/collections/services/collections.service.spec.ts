import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { Logger } from '@nestjs/common';
import { CollectionsService } from './collections.service';
import { LedgerService } from './ledger.service';
import { CollectionEntity } from '../entities/collection.entity';

describe('CollectionsService', () => {
  let service: CollectionsService;
  let ledgerService: jest.Mocked<LedgerService>;
  let repository: jest.Mocked<Repository<CollectionEntity>>;

  beforeAll(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterAll(() => {
    jest.restoreAllMocks();
  });

  const mockAnchorCreatedEvent = {
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
        meta: {},
      },
    },
  };

  const mockIntent = {
    data: {
      handle: '0076570881:FACT-2024-001246',
      schema: 'payment-collection',
      claims: [],
    },
    meta: { proofs: [] },
  };

  const mockCollection = {
    id: 'uuid-1',
    merchantTxId: '0076570881:FACT-2024-001246',
    anchorHandle: 'QR-123-abc',
    intentHandle: '0076570881:FACT-2024-001246',
    schema: 'qr-code',
    status: 'PENDING',
    anchorData: {},
    intentData: {},
    fulfillmentEvidence: null as unknown as Record<string, any>,
    fulfilledAt: null as unknown as Date,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as CollectionEntity;

  beforeEach(async () => {
    const mockLedgerService = {
      getIntent: jest.fn(),
      createIntent: jest.fn(),
      addAnchorLabelToIntent: jest.fn(),
      findAnchorByIdQROrAliasValue: jest.fn(),
      getIntentByMerchantCodeAndPaymentReference: jest.fn(),
      intentHasCommittedProofFromUs: jest.fn(),
      submitProof: jest.fn(),
      getAnchorHandlesFromIntentLabels: jest.fn(),
      anchorHasProofFromUs: jest.fn(),
      addProofToAnchor: jest.fn(),
    };

    const mockRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollectionsService,
        { provide: LedgerService, useValue: mockLedgerService },
        { provide: getRepositoryToken(CollectionEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
    ledgerService = module.get(LedgerService) as jest.Mocked<LedgerService>;
    repository = module.get(getRepositoryToken(CollectionEntity)) as jest.Mocked<Repository<CollectionEntity>>;
    jest.clearAllMocks();
  });

  describe('handleAnchorCreated', () => {
    it('creates collection and intent when none exist', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);
      (repository.create as jest.Mock).mockImplementation((dto) => ({ ...mockCollection, ...dto }));
      (repository.save as jest.Mock).mockResolvedValue(mockCollection);
      (ledgerService.getIntent as jest.Mock).mockRejectedValue(new Error('not found'));
      (ledgerService.createIntent as jest.Mock).mockResolvedValue({ data: mockIntent.data });

      const result = await service.handleAnchorCreated(mockAnchorCreatedEvent as any);

      expect(repository.findOne).toHaveBeenCalledWith({ where: { merchantTxId: '0076570881:FACT-2024-001246' } });
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantTxId: '0076570881:FACT-2024-001246',
          anchorHandle: 'QR-123-abc',
          schema: 'qr-code',
          status: 'PENDING',
        }),
      );
      expect(repository.save).toHaveBeenCalled();
      expect(ledgerService.createIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          handle: '0076570881:FACT-2024-001246',
          anchorHandle: 'QR-123-abc',
          anchorSchema: 'qr-code',
          symbolHandle: 'cop',
          amount: 10000,
        }),
      );
      expect(result).toBeDefined();
      expect(result.intentHandle).toBe('0076570881:FACT-2024-001246');
    });

    it('adds anchor label when intent already exists', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(mockCollection);
      (repository.save as jest.Mock).mockResolvedValue(mockCollection);
      (ledgerService.getIntent as jest.Mock).mockResolvedValue(mockIntent);
      (ledgerService.addAnchorLabelToIntent as jest.Mock).mockResolvedValue({});
      (ledgerService.getIntent as jest.Mock).mockResolvedValue(mockIntent);

      await service.handleAnchorCreated(mockAnchorCreatedEvent as any);

      expect(ledgerService.addAnchorLabelToIntent).toHaveBeenCalledWith(
        '0076570881:FACT-2024-001246',
        'QR-123-abc',
        'qr-code',
      );
      expect(ledgerService.createIntent).not.toHaveBeenCalled();
    });

    it('throws when anchor has no handle', async () => {
      const badEvent = { data: { anchor: { data: {} } } };
      await expect(service.handleAnchorCreated(badEvent as any)).rejects.toThrow('Anchor handle not found');
    });

    it('throws when merchantCode or paymentReferenceNumber missing', async () => {
      const noTarget = {
        data: {
          anchor: {
            data: {
              handle: 'QR-1',
              schema: 'qr-code',
              custom: {},
              target: {},
              symbol: { handle: 'cop' },
              amount: 100,
            },
          },
        },
      };
      await expect(service.handleAnchorCreated(noTarget as any)).rejects.toThrow();
    });
  });

  describe('processIntentUpdatedEventAsync', () => {
    it('skips when status is not committed', async () => {
      const body = {
        data: {
          intent: { data: { handle: 'i1' }, meta: { status: 'prepared' } },
        },
      };
      await service.processIntentUpdatedEventAsync(body as any, {} as any);
      expect(ledgerService.findAnchorByIdQROrAliasValue).not.toHaveBeenCalled();
    });

    it('skips when no claims or target', async () => {
      const body = {
        data: {
          intent: { data: { handle: 'i1', claims: [] }, meta: { status: 'committed' } },
        },
      };
      await service.processIntentUpdatedEventAsync(body as any, {} as any);
      expect(ledgerService.findAnchorByIdQROrAliasValue).not.toHaveBeenCalled();
    });

    it('finds anchor, intent, submits proof and updates collection when committed', async () => {
      const body = {
        data: {
          intent: {
            data: {
              handle: 'rtp-intent-123',
              claims: [{ target: { custom: { idQR: 'CO.COM.SVB.TRXID123' } } }],
            },
            meta: { status: 'committed' },
          },
        },
      };
      const anchorRecord = { data: { handle: 'QR-123', custom: { paymentReferenceNumber: 'FACT-2024-001246' }, target: { custom: { merchantCode: '0076570881' } } } };
      (ledgerService.findAnchorByIdQROrAliasValue as jest.Mock).mockResolvedValue(anchorRecord);
      (ledgerService.getIntentByMerchantCodeAndPaymentReference as jest.Mock).mockResolvedValue(mockIntent);
      (ledgerService.intentHasCommittedProofFromUs as jest.Mock).mockResolvedValue(false);
      (ledgerService.submitProof as jest.Mock).mockResolvedValue({});
      (ledgerService.getIntent as jest.Mock).mockResolvedValue({ meta: { labels: ['QR-123:qr-code'] } });
      (ledgerService.getAnchorHandlesFromIntentLabels as jest.Mock).mockReturnValue(['QR-123']);
      (ledgerService.anchorHasProofFromUs as jest.Mock).mockResolvedValue(false);
      (ledgerService.addProofToAnchor as jest.Mock).mockResolvedValue({});
      (repository.findOne as jest.Mock).mockResolvedValue(mockCollection);
      (repository.save as jest.Mock).mockResolvedValue(mockCollection);

      await service.processIntentUpdatedEventAsync(body as any, {} as any);

      expect(ledgerService.findAnchorByIdQROrAliasValue).toHaveBeenCalledWith('CO.COM.SVB.TRXID123', null);
      expect(ledgerService.getIntentByMerchantCodeAndPaymentReference).toHaveBeenCalledWith('0076570881', 'FACT-2024-001246');
      expect(ledgerService.submitProof).toHaveBeenCalledWith(
        '0076570881:FACT-2024-001246',
        expect.objectContaining({
          rtpIntentHandle: 'rtp-intent-123',
          rtpStatus: 'committed',
          anchorHandle: 'QR-123',
        }),
      );
      expect(ledgerService.addProofToAnchor).toHaveBeenCalledWith(
        'QR-123',
        expect.objectContaining({ status: 'COMPLETED', reason: 'completed' }),
      );
      expect(repository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'COMPLETED',
          fulfillmentEvidence: expect.any(Object),
        }),
      );
    });
  });

  describe('getCollectionByMerchantTxId', () => {
    it('returns collection when found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(mockCollection);
      const result = await service.getCollectionByMerchantTxId('0076570881:FACT-2024-001246');
      expect(result).toEqual(mockCollection);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { merchantTxId: '0076570881:FACT-2024-001246' } });
    });

    it('throws NotFoundException when not found', async () => {
      (repository.findOne as jest.Mock).mockResolvedValue(null);
      await expect(service.getCollectionByMerchantTxId('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCollections', () => {
    it('applies filters and returns list', async () => {
      const getMany = jest.fn().mockResolvedValue([mockCollection]);
      (repository.createQueryBuilder as jest.Mock).mockReturnValue({
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany,
      });
      const result = await service.getCollections({ status: 'PENDING', merchantTxId: 'tx-1' });
      expect(result).toEqual([mockCollection]);
      expect(getMany).toHaveBeenCalled();
    });
  });
});
