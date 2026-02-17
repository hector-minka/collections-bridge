# Collections Bridge - Project Summary

## Overview

This is a **standalone bridge service** for Minka Ledger collections operations. It was created based on the patterns and architecture from the `qr-bridge` project, providing a solid foundation for building collection-related functionality.

## Project Status

✅ **Foundation Complete** - The project has been set up with:
- Complete NestJS application structure
- All cryptographic utilities (crypto-utils)
- Docker configuration
- Health checks and monitoring
- Swagger/OpenAPI documentation
- Error handling and logging

🔄 **Ready for Development** - The following areas need implementation:
- Collection-specific business logic
- Database entities for collections
- API endpoints for collection operations
- Integration with Minka Ledger SDK

## Architecture

### Technology Stack

- **Framework**: NestJS 10.x (TypeScript)
- **Database**: PostgreSQL 15 (via TypeORM)
- **Authentication**: JWT with Ed25519 signing
- **Logging**: Pino with structured logging
- **Documentation**: Swagger/OpenAPI
- **Containerization**: Docker & Docker Compose

### Project Structure

```
collections-bridge/
├── crypto-utils/              # Cryptographic utilities (STANDALONE)
│   ├── hash.ts               # SHA-256 hash generation (RFC 8785)
│   ├── signature.ts          # Ed25519 signature generation
│   ├── jwt.ts                # JWT signing for ledger auth
│   ├── keys.ts               # Ed25519 key import/management
│   ├── asn1.ts               # ASN.1 key format conversion
│   ├── utils.ts              # Convenience functions
│   └── index.ts              # Public API exports
│
├── src/
│   ├── main.ts               # Application bootstrap
│   ├── app.module.ts         # Root module (imports all modules)
│   ├── app.controller.ts     # Root controller
│   │
│   ├── config/
│   │   └── configuration.ts  # Environment configuration
│   │
│   ├── health/
│   │   ├── health.module.ts  # Health check module
│   │   └── health.controller.ts  # Health endpoints
│   │
│   └── common/
│       └── filters/
│           └── http-exception.filter.ts  # Global error handler
│
├── docker-compose.yml        # Docker Compose config
├── Dockerfile               # Multi-stage Docker build
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── nest-cli.json            # NestJS CLI config
```

## Key Components

### 1. Crypto Utilities (`crypto-utils/`)

**Purpose**: Complete cryptographic operations for Minka Ledger integration.

**Key Functions**:

```typescript
// Hash generation
import { generateHash } from './crypto-utils';
const hash = generateHash(data); // SHA-256 hash

// Signature generation
import { generateSignature } from './crypto-utils';
const { hash, digest, result } = generateSignature(
  data,
  secretKey,
  signatureCustom
);

// JWT signing
import { signJWT } from './crypto-utils';
const token = await signJWT(payload, secretKey, publicKey);
```

**Documentation**: See `crypto-utils/README.md` for complete API reference.

### 2. Configuration (`src/config/configuration.ts`)

**Environment Variables**:

```env
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
LOG_LEVEL=info

# Minka Ledger
MINKA_LEDGER_SERVER=https://ledger.minka.io
MINKA_LEDGER_NAME=your-ledger-name
MINKA_LEDGER_TIMEOUT=15000
MINKA_LEDGER_PUBLIC_KEY=...

# Signer (Ed25519)
MINKA_SIGNER_FORMAT=ed25519-raw
MINKA_SIGNER_PUBLIC=...
MINKA_SIGNER_SECRET=...

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=collections_bridge
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

### 3. Error Handling (`src/common/filters/http-exception.filter.ts`)

**Format**: All errors follow Minka Ledger format:
```json
{
  "reason": "ApiBodyMalformed",
  "detail": "Error message",
  "custom": { /* optional */ }
}
```

**Mapping**: HTTP status codes are automatically mapped to `LedgerErrorReason` from `@minka/ledger-sdk`.

### 4. Health Checks (`src/health/`)

**Endpoints**:
- `GET /api/v1/health` - Full health check (memory, disk)
- `GET /api/v1/health/liveness` - Liveness probe
- `GET /api/v1/health/readiness` - Readiness probe

## Patterns from QR Bridge

This project follows the same patterns as `qr-bridge`:

### 1. **Module Structure**
- Each feature has its own module (e.g., `collections.module.ts`)
- Controllers handle HTTP requests
- Services contain business logic
- DTOs for request/response validation

### 2. **Ledger Integration**
- Use `@minka/ledger-sdk` for ledger operations
- Sign all requests using `crypto-utils`
- Handle `LedgerError` exceptions properly
- Follow anchor forwarding patterns

### 3. **Database**
- Use TypeORM entities
- Configure in `app.module.ts`
- Use migrations for schema changes (set `DB_SYNCHRONIZE=false` in production)

### 4. **Security**
- Helmet for HTTP headers
- CORS configuration
- Rate limiting (100 req/min)
- Input validation with `class-validator`

### 5. **Logging**
- Structured logging with Pino
- Request/response serialization
- Error logging with stack traces

## Next Steps for Development

### 1. Create Collections Module

```typescript
// src/collections/collections.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([CollectionEntity])],
  controllers: [CollectionsController],
  providers: [CollectionsService],
})
export class CollectionsModule {}
```

### 2. Define Database Entities

```typescript
// src/collections/entities/collection.entity.ts
@Entity('collections')
export class CollectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  handle: string;

  // ... other fields
}
```

### 3. Create Services

```typescript
// src/collections/services/collections.service.ts
@Injectable()
export class CollectionsService {
  constructor(
    @InjectRepository(CollectionEntity)
    private repository: Repository<CollectionEntity>,
    private configService: ConfigService,
  ) {}

  async createCollection(data: CreateCollectionDto) {
    // 1. Generate hash
    // 2. Sign with crypto-utils
    // 3. Send to ledger
    // 4. Save to database
  }
}
```

### 4. Implement API Endpoints

```typescript
// src/collections/collections.controller.ts
@Controller({ path: 'collections', version: '1' })
@ApiTags('collections')
export class CollectionsController {
  @Post()
  @ApiOperation({ summary: 'Create a collection' })
  async create(@Body() dto: CreateCollectionDto) {
    return this.service.createCollection(dto);
  }
}
```

### 5. Add to App Module

```typescript
// src/app.module.ts
@Module({
  imports: [
    // ... existing imports
    CollectionsModule,
  ],
})
export class AppModule {}
```

## Example: Creating an Anchor

Here's how to create and sign an anchor (pattern from qr-bridge):

```typescript
import { generateSignature, signJWT } from '../crypto-utils';
import { LedgerSdk } from '@minka/ledger-sdk';

async function createAnchor(data: any) {
  const config = this.configService.get('minka');
  
  // 1. Prepare signature custom data
  const signatureCustom = {
    moment: new Date().toISOString(),
    status: 'ACTIVE',
  };

  // 2. Generate signature
  const { hash, digest, result } = generateSignature(
    data,
    config.signer.secret,
    signatureCustom
  );

  // 3. Create JWT for authentication
  const jwt = await signJWT(
    {
      iss: config.signer.public,
      sub: `signer:${config.signer.public}`,
      aud: config.ledger.ledger,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    config.signer.secret,
    config.signer.public
  );

  // 4. Initialize SDK
  const sdk = new LedgerSdk({
    ledger: config.ledger.ledger,
    server: config.ledger.server,
    signer: {
      format: config.signer.format,
      public: config.signer.public,
    },
    secure: {
      iss: config.signer.public,
      sub: `signer:${config.signer.public}`,
      aud: config.ledger.ledger,
      exp: 60,
      keyPair: {
        format: config.signer.format,
        public: config.signer.public,
        secret: config.signer.secret,
      },
    },
  });

  // 5. Create anchor
  const { response } = await sdk.anchor
    .init()
    .data(data)
    .meta({
      labels: [],
      proofs: [{
        method: 'ed25519-v2',
        custom: signatureCustom,
        digest,
        public: config.signer.public,
        result,
      }],
    })
    .hash()
    .sign([{
      keyPair: {
        format: config.signer.format,
        public: config.signer.public,
        secret: config.signer.secret,
      },
      custom: signatureCustom,
    }])
    .send();

  return response;
}
```

## Testing

### Unit Tests

```typescript
// src/collections/services/collections.service.spec.ts
describe('CollectionsService', () => {
  let service: CollectionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [CollectionsService],
    }).compile();

    service = module.get<CollectionsService>(CollectionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// test/collections.e2e-spec.ts
describe('Collections (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/collections (POST)', () => {
    return request(app.getHttpServer())
      .post('/api/v1/collections')
      .send({ /* test data */ })
      .expect(201);
  });
});
```

## Docker Commands

### Development

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f app
docker-compose logs -f postgres

# Stop services
docker-compose down

# Rebuild
docker-compose up -d --build
```

### Production

```bash
# Build
docker-compose -f docker-compose.prod.yml build

# Start
docker-compose -f docker-compose.prod.yml up -d
```

## Common Issues & Solutions

### 1. Build Errors

**Issue**: TypeScript compilation errors
**Solution**: 
- Check `tsconfig.json` includes `crypto-utils/**/*`
- Ensure all dependencies are installed: `npm install`

### 2. Database Connection

**Issue**: Cannot connect to PostgreSQL
**Solution**:
- Check `.env` file has correct DB credentials
- Ensure PostgreSQL is running: `docker-compose ps`
- Check network: `docker-compose network ls`

### 3. Ledger Authentication

**Issue**: JWT signing fails
**Solution**:
- Verify `MINKA_SIGNER_SECRET` and `MINKA_SIGNER_PUBLIC` are base64-encoded
- Check key format is `ed25519-raw`
- Ensure keys are 32 bytes (64 hex characters)

## References

### Documentation

- **Minka Ledger SDK**: https://docs.minka.io/ledger/
- **NestJS**: https://docs.nestjs.com/
- **TypeORM**: https://typeorm.io/
- **RFC 8785**: JSON Canonicalization Scheme
- **RFC 8410**: Ed25519 Algorithm

### Related Projects

- **qr-bridge**: Reference implementation with QR code generation
- **payments-hub**: Similar bridge patterns

## Support

For questions or issues:
1. Check the `crypto-utils/README.md` for crypto utilities
2. Review `qr-bridge` for implementation patterns
3. Consult Minka Ledger documentation

---

**Last Updated**: 2025-01-27
**Foundation Version**: 1.0.0
**Status**: Ready for development
