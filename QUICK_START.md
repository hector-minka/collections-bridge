# Quick Start Guide

## Prerequisites

- Node.js 18+ installed
- Docker and Docker Compose (optional, for database)
- Minka Ledger credentials

## Setup Steps

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
LOG_LEVEL=info

# Minka Ledger
MINKA_LEDGER_SERVER=https://ldg-stg.one/api/v2
MINKA_LEDGER_NAME=your-ledger-name
MINKA_LEDGER_TIMEOUT=15000
MINKA_LEDGER_PUBLIC_KEY=your-ledger-public-key-base64

# Signer (Ed25519 keys in base64)
MINKA_SIGNER_FORMAT=ed25519-raw
MINKA_SIGNER_PUBLIC=your-public-key-base64
MINKA_SIGNER_SECRET=your-secret-key-base64

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=collections_bridge
DB_SYNCHRONIZE=false
DB_LOGGING=false
```

### 3. Start Database (Docker)

```bash
docker-compose up -d postgres
```

Or use your own PostgreSQL instance and update `.env` accordingly.

### 4. Run Application

**Development mode:**
```bash
npm run start:dev
```

**Production mode:**
```bash
npm run build
npm run start:prod
```

### 5. Access API

- **API**: http://localhost:3000/api
- **Swagger Docs**: http://localhost:3000/api/docs
- **Health Check**: http://localhost:3000/api/v1/health

## Using Docker Compose (Full Stack)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop services
docker-compose down
```

## Next Steps

1. Review `PROJECT_SUMMARY.md` for architecture details
2. Check `crypto-utils/README.md` for cryptographic utilities
3. Start implementing your collections module
4. See `PROJECT_SUMMARY.md` for development patterns

## Troubleshooting

### Port Already in Use
```bash
# Change PORT in .env file
PORT=3001
```

### Database Connection Failed
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection string in .env
# Ensure DB_NAME matches database name
```

### Build Errors
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

## Development Workflow

1. **Create a new module**:
   ```bash
   nest generate module collections
   nest generate controller collections
   nest generate service collections
   ```

2. **Add to app.module.ts**:
   ```typescript
   imports: [
     // ... existing
     CollectionsModule,
   ]
   ```

3. **Implement business logic** in services
4. **Add API endpoints** in controllers
5. **Test** with Swagger UI or Postman

## Key Files

- `src/main.ts` - Application entry point
- `src/app.module.ts` - Root module
- `src/config/configuration.ts` - Environment config
- `crypto-utils/` - Cryptographic utilities
- `PROJECT_SUMMARY.md` - Complete project documentation
