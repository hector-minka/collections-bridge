# Minka Collections Bridge API

API for collections operations in the Minka Ledger. This service provides a bridge for handling collection-related anchors, signing, and forwarding to the ledger.

## Features

- ✅ Anchor creation and management
- ✅ Cryptographic signing with Ed25519
- ✅ JWT authentication for ledger requests
- ✅ TypeScript with NestJS framework
- ✅ Comprehensive security features (Helmet, CORS, Rate Limiting)
- ✅ Input validation and error handling
- ✅ Structured logging with Pino
- ✅ Health checks and monitoring
- ✅ Swagger/OpenAPI documentation

## Prerequisites

- Node.js 18+
- Yarn or npm
- PostgreSQL (for production)

## Installation

```bash
npm install
# or
yarn install
```

## Configuration

Create a `.env` file in the root directory:

```env
# Server
PORT=3000
NODE_ENV=development

# CORS
CORS_ORIGIN=*

# Logging
LOG_LEVEL=info

# Minka Ledger Configuration
MINKA_LEDGER_SERVER=https://ledger.minka.io
MINKA_LEDGER_NAME=your-ledger-name
MINKA_LEDGER_TIMEOUT=15000
MINKA_LEDGER_PUBLIC_KEY=your-ledger-public-key

# Minka Signer Configuration
MINKA_SIGNER_FORMAT=ed25519-raw
MINKA_SIGNER_PUBLIC=your-public-key
MINKA_SIGNER_SECRET=your-secret-key

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=collections_bridge
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

## Running the Application

### Development

```bash
npm run start:dev
# or
yarn start:dev
```

### Production

```bash
npm run build
npm run start:prod
# or
yarn build
yarn start:prod
```

## Docker

### Development

```bash
docker-compose up -d
```

### View Logs

```bash
docker-compose logs -f app
docker-compose logs -f postgres
```

## API Documentation

Once the application is running, visit:
- Swagger UI: http://localhost:3000/api/docs

For detailed endpoint documentation, see:
- **API Endpoints Guide**: [API_ENDPOINTS.md](./API_ENDPOINTS.md) - Complete documentation of all endpoints, including webhooks and query endpoints

## Crypto Utilities

This bridge includes a complete set of cryptographic utilities in the `crypto-utils` directory:

- **Hash Generation**: SHA-256 hashes with RFC 8785 compatible JSON serialization
- **Signature Digests**: Double-hashed signature digests with custom metadata
- **Signature Results**: Ed25519 signatures for ledger requests
- **JWT Signing**: JWT tokens for ledger authentication
- **Key Management**: Import Ed25519 keys from raw base64 format

See `crypto-utils/README.md` for detailed documentation and usage examples.

## Project Structure

```
collections-bridge/
├── crypto-utils/          # Cryptographic utilities
│   ├── hash.ts           # Hash generation
│   ├── signature.ts      # Signature generation
│   ├── jwt.ts            # JWT signing
│   ├── keys.ts           # Key management
│   └── ...
├── src/
│   ├── main.ts           # Application entry point
│   ├── app.module.ts     # Root module
│   ├── app.controller.ts # Root controller
│   ├── config/           # Configuration
│   ├── health/           # Health checks
│   └── common/           # Common utilities
├── docker-compose.yml     # Docker Compose configuration
├── Dockerfile            # Docker build file
└── package.json          # Dependencies
```

## Development

### Code Style

This project uses ESLint and Prettier for code formatting:

```bash
npm run lint
npm run format
```

### Testing

```bash
npm run test
npm run test:watch
npm run test:cov
```

## License

MIT
