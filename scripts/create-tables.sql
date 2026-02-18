-- Collections Bridge: init script for PostgreSQL
-- Ensures extensions and tables exist (when DB_SYNCHRONIZE=false, TypeORM does not create them)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Table: collections (matches TypeORM migration CreateCollectionsTable1736698762000)
CREATE TABLE IF NOT EXISTS collections (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "merchantTxId" varchar(255) NOT NULL,
  "anchorHandle" varchar(255),
  "intentHandle" varchar(255),
  schema varchar(50),
  status varchar(50) DEFAULT 'PENDING',
  "anchorData" jsonb,
  "intentData" jsonb,
  "fulfillmentEvidence" jsonb,
  "fulfilledAt" timestamp,
  "createdAt" timestamp DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "IDX_collections_merchantTxId" ON collections ("merchantTxId");
CREATE INDEX IF NOT EXISTS "IDX_collections_anchorHandle" ON collections ("anchorHandle");
CREATE INDEX IF NOT EXISTS "IDX_collections_intentHandle" ON collections ("intentHandle");
