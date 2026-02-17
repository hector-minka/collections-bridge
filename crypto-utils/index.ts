/**
 * Minka Ledger Crypto Utilities
 * 
 * A reusable utility module for hashing, signing, and JWT generation
 * for Minka Ledger API requests.
 * 
 * @example
 * ```typescript
 * import { generateHash, generateDigest, generateSignature, signJWT } from './crypto-utils';
 * 
 * // Generate hash
 * const hash = generateHash(data);
 * 
 * // Generate digest
 * const digest = generateDigest(hash, customMetadata);
 * 
 * // Generate complete signature
 * const { hash, digest, result } = generateSignature(data, secretKey, customMetadata);
 * 
 * // Sign JWT
 * const token = await signJWT(payload, secretKey, publicKey);
 * ```
 */

// Hash utilities
export {
  serializeData,
  createHash,
  createSignatureDigest,
} from "./hash";

// Key utilities
export {
  importPrivateKey,
  importPublicKey,
} from "./keys";

// Signature utilities
export {
  generateSignature,
} from "./signature";

// JWT utilities
export {
  signJWT,
} from "./jwt";

// Convenience functions that combine common operations
export {
  generateHash,
  generateDigest,
  generateResult,
} from "./utils";
