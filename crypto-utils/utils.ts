import { createHash, createSignatureDigest } from "./hash";
import { generateSignature } from "./signature";

/**
 * Convenience function to generate a hash from data.
 * Alias for createHash() for better discoverability.
 * 
 * @param data - Data to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function generateHash(data: any): string {
  return createHash(data);
}

/**
 * Convenience function to generate a signature digest.
 * Alias for createSignatureDigest() for better discoverability.
 * 
 * @param dataHash - Hex-encoded hash of the primary data
 * @param signatureCustom - Optional custom metadata to include in the digest
 * @returns Hex-encoded signature digest
 */
export function generateDigest(
  dataHash: string,
  signatureCustom?: Record<string, any>
): string {
  return createSignatureDigest(dataHash, signatureCustom);
}

/**
 * Generates only the signature result (base64-encoded signature).
 * This is a convenience function if you only need the result field.
 * 
 * @param data - The data object to sign
 * @param secretKey - Base64-encoded raw Ed25519 private key
 * @param signatureCustom - Optional custom metadata to include in the signature
 * @returns Base64-encoded signature result
 */
export function generateResult(
  data: any,
  secretKey: string,
  signatureCustom?: Record<string, any>
): string {
  const { result } = generateSignature(data, secretKey, signatureCustom);
  return result;
}
