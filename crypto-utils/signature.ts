import * as crypto from "crypto";
import { createHash, createSignatureDigest } from "./hash";
import { importPrivateKey } from "./keys";

/**
 * Generates a signature result (base64-encoded) for ledger requests.
 * This is the cryptographic signature that proves the request was signed
 * by the holder of the private key.
 * 
 * @param data - The data object to sign
 * @param secretKey - Base64-encoded raw Ed25519 private key
 * @param signatureCustom - Optional custom metadata to include in the signature
 * @returns Object containing the hash, digest, and base64-encoded signature result
 */
export function generateSignature(
  data: any,
  secretKey: string,
  signatureCustom?: Record<string, any>
): {
  hash: string;
  digest: string;
  result: string;
} {
  // Step 1: Create hash of the data
  const hash = createHash(data);

  // Step 2: Create signature digest (double hash with custom data)
  const digest = createSignatureDigest(hash, signatureCustom);

  // Step 3: Convert digest to buffer
  const digestBuffer = Buffer.from(digest, "hex");

  // Step 4: Import private key from raw format
  const privateKey = importPrivateKey(secretKey);

  // Step 5: Sign the digest with Ed25519
  // Note: First argument must be undefined for ed25519
  // see: https://github.com/mscdex/io.js/commit/7d0e50dcfef98ca56715adf74678bcaf4aa08796
  const result = crypto
    .sign(undefined, digestBuffer, privateKey)
    .toString("base64");

  return {
    hash,
    digest,
    result,
  };
}
