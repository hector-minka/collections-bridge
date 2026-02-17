# Minka Ledger Crypto Utilities

A reusable TypeScript utility module for cryptographic operations required by the Minka Ledger API, including hashing, signing, and JWT generation.

## Features

- **Hash Generation**: Create SHA-256 hashes with RFC 8785 compatible JSON serialization
- **Signature Digests**: Generate double-hashed signature digests with custom metadata
- **Signature Results**: Generate Ed25519 signatures for ledger requests
- **JWT Signing**: Sign JWT tokens for ledger authentication
- **Key Management**: Import Ed25519 keys from raw base64 format

## Installation

This module requires the following dependencies:

```json
{
  "dependencies": {
    "@minka/ledger-sdk": "^2.25.0",
    "@noble/ed25519": "^1.0.0",
    "base64url": "^3.0.1",
    "detect-node": "^2.1.0",
    "jose": "^6.0.11",
    "safe-stable-stringify": "^2.5.0"
  }
}
```

## Usage

### Basic Usage

```typescript
import {
  generateHash,
  generateDigest,
  generateSignature,
  signJWT,
} from './crypto-utils';

// Your signer credentials
const SECRET_KEY = "your-base64-encoded-secret-key";
const PUBLIC_KEY = "your-base64-encoded-public-key";

// Data to sign
const data = {
  handle: "intent:123",
  claims: [...],
  // ... other fields
};

// Custom metadata for signature
const signatureCustom = {
  moment: new Date().toISOString(),
  status: "created",
  dispatched: new Date().toISOString(),
  received: new Date().toISOString(),
};
```

### Generate Hash

```typescript
const hash = generateHash(data);
// Returns: "a1b2c3d4e5f6..." (hex-encoded SHA-256 hash)
```

### Generate Digest

```typescript
const hash = generateHash(data);
const digest = generateDigest(hash, signatureCustom);
// Returns: "f6e5d4c3b2a1..." (hex-encoded signature digest)
```

### Generate Complete Signature

This function generates the hash, digest, and signature result in one call:

```typescript
const { hash, digest, result } = generateSignature(
  data,
  SECRET_KEY,
  signatureCustom
);

// Use in your request
const request = {
  data,
  hash,
  meta: {
    proofs: [{
      method: "ed25519-v2",
      custom: signatureCustom,
      digest,
      public: PUBLIC_KEY,
      result, // Base64-encoded signature
    }],
  },
};
```

### Generate Only Result

If you already have the hash and digest, you can generate just the result:

```typescript
const result = generateResult(data, SECRET_KEY, signatureCustom);
```

### Sign JWT

```typescript
const payload = {
  iss: "your-signer-id",
  sub: "signer:your-signer-id",
  aud: "your-ledger-id",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

const token = await signJWT(payload, SECRET_KEY, PUBLIC_KEY);

// Use in Authorization header
const headers = {
  Authorization: `Bearer ${token}`,
};
```

### Complete Example

```typescript
import {
  generateSignature,
  signJWT,
} from './crypto-utils';

async function createIntent() {
  const data = {
    handle: "intent:123",
    claims: [/* ... */],
    schema: "payment",
    // ... other fields
  };

  const signatureCustom = {
    moment: new Date().toISOString(),
    status: "created",
    dispatched: new Date().toISOString(),
    received: new Date().toISOString(),
  };

  // Generate signature
  const { hash, digest, result } = generateSignature(
    data,
    SECRET_KEY,
    signatureCustom
  );

  // Create JWT
  const jwt = await signJWT(
    {
      iss: "your-signer",
      sub: "signer:your-signer",
      aud: "your-ledger",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    SECRET_KEY,
    PUBLIC_KEY
  );

  // Make request
  const response = await fetch('https://api.example.com/intents', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      data,
      hash,
      meta: {
        proofs: [{
          method: "ed25519-v2",
          custom: signatureCustom,
          digest,
          public: PUBLIC_KEY,
          result,
        }],
      },
    }),
  });
}
```

## API Reference

### Hash Functions

- `generateHash(data: any): string` - Creates a SHA-256 hash of the data
- `generateDigest(dataHash: string, signatureCustom?: Record<string, any>): string` - Creates a signature digest
- `serializeData(data: any): string` - Serializes data using RFC 8785 compatible JSON

### Signature Functions

- `generateSignature(data: any, secretKey: string, signatureCustom?: Record<string, any>)` - Generates complete signature (hash, digest, result)
- `generateResult(data: any, secretKey: string, signatureCustom?: Record<string, any>): string` - Generates only the signature result

### JWT Functions

- `signJWT(payload: LedgerJWTPayload, secretKey: string, kid?: string): Promise<string>` - Signs a JWT token

### Key Functions

- `importPrivateKey(key: string): KeyObject` - Imports a private key from base64 raw format
- `importPublicKey(key: string, format?: string): KeyObject` - Imports a public key from base64 raw format

## Notes

- All keys should be in base64-encoded raw Ed25519 format
- The module automatically converts raw keys to DER format for Node.js crypto operations
- JWT signing works in both Node.js and browser environments
- Hash generation uses RFC 8785 compatible JSON serialization for deterministic results

## References

- [Minka Ledger Documentation](https://docs.minka.io/ledger/how-to-guides/hash-and-sign-ledger-requests/)
- [RFC 8785 - JSON Canonicalization Scheme](https://datatracker.ietf.org/doc/html/rfc8785)
- [RFC 8410 - Ed25519 Algorithm](https://datatracker.ietf.org/doc/html/rfc8410)
