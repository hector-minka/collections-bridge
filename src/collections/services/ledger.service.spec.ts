import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { LedgerService } from './ledger.service';

describe('LedgerService', () => {
  let service: LedgerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const m: Record<string, any> = {
                minka: {
                  ledger: { server: 'https://test.ledger', ledger: 'test-ledger' },
                  signer: { format: 'ed25519-raw', public: 'pub', secret: 'sec' },
                },
              };
              return key.split('.').reduce((o, k) => o?.[k], m);
            }),
          },
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    const fromChain = () => ({ hash: () => ({ sign: () => ({ send: () => Promise.resolve({ response: {} }) }) }) });
    (service as any).sdk = {
      anchor: { read: jest.fn(), list: jest.fn(), from: jest.fn().mockImplementation(fromChain) },
      intent: { read: jest.fn(), list: jest.fn(), init: jest.fn(), from: jest.fn().mockImplementation(fromChain) },
    };
  });

  describe('getAnchorHandlesFromIntentLabels', () => {
    it('extracts anchor handles from labels in format "handle:schema"', () => {
      const record = { meta: { labels: ['QR-123:qr-code', 'QR-456:qr-code'] } };
      expect(service.getAnchorHandlesFromIntentLabels(record)).toEqual(['QR-123', 'QR-456']);
    });

    it('skips merchant-txid label', () => {
      const record = { meta: { labels: ['merchant-txid:tx-123', 'QR-789:qr-code'] } };
      expect(service.getAnchorHandlesFromIntentLabels(record)).toEqual(['QR-789']);
    });

    it('returns unique handles', () => {
      const record = { meta: { labels: ['QR-1:qr-code', 'QR-1:qr-code'] } };
      expect(service.getAnchorHandlesFromIntentLabels(record)).toEqual(['QR-1']);
    });

    it('returns empty array when no labels', () => {
      expect(service.getAnchorHandlesFromIntentLabels({})).toEqual([]);
      expect(service.getAnchorHandlesFromIntentLabels({ meta: {} })).toEqual([]);
      expect(service.getAnchorHandlesFromIntentLabels({ meta: { labels: [] } })).toEqual([]);
    });

    it('supports labels at top level (record.labels)', () => {
      const record = { labels: ['ANCHOR-1:dynamic-key'] };
      expect(service.getAnchorHandlesFromIntentLabels(record)).toEqual(['ANCHOR-1']);
    });
  });
});
