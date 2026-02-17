export default () => ({
  port: parseInt(process.env.PORT || '3000', 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  logLevel: process.env.LOG_LEVEL || 'info',
  minka: {
    ledger: {
      server: process.env.MINKA_LEDGER_SERVER || '',
      ledger: process.env.MINKA_LEDGER_NAME || '',
      timeout: parseInt(process.env.MINKA_LEDGER_TIMEOUT || '15000', 10) || 15000,
      publicKey: process.env.MINKA_LEDGER_PUBLIC_KEY || '',
    },
    signer: {
      format: process.env.MINKA_SIGNER_FORMAT || 'ed25519-raw',
      public: process.env.MINKA_SIGNER_PUBLIC || '',
      secret: process.env.MINKA_SIGNER_SECRET || '',
    },
    /** Claim source handle for payment-collection intents (wallet/account must exist in Ledger). */
    intentClaimSourceHandle:
      process.env.INTENT_CLAIM_SOURCE_HANDLE || process.env.MINKA_INTENT_CLAIM_SOURCE_HANDLE || 'servibanca',
  },
  database: {
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10) || 5432,
    username: process.env.DB_USERNAME || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    database: process.env.DB_NAME || 'collections_bridge',
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
});
