import * as crypto from "crypto";
import stringify from "safe-stable-stringify";

const HASHING_ALGORITHM = "sha256";

/**
 * Serializes data using RFC 8785 compatible JSON serialization
 * Ensures deterministic ordering of object properties
 * 
 * @param data - Data to serialize
 * @returns Serialized JSON string
 * @throws Error if serialization fails
 */
export function serializeData(data: any): string {
  const result = stringify(data);
  if (result === undefined) {
    throw new Error("serializeData: failed to stringify input");
  }
  return result;
}

/**
 * Creates a SHA-256 hash of the input data.
 * Uses RFC 8785 compatible serialization for deterministic hashing.
 * 
 * @param data - Data to hash
 * @returns Hex-encoded SHA-256 hash
 */
export function createHash(data: any): string {
  const serialized = serializeData(data);
  return crypto.createHash(HASHING_ALGORITHM).update(serialized).digest("hex");
}

/**
 * Creates a signature digest by double-hashing the data hash with custom metadata.
 * This prevents certain cryptographic attacks and allows including additional
 * data in the signature without changing the primary payload hash.
 * 
 * @param dataHash - Hex-encoded hash of the primary data
 * @param signatureCustom - Optional custom metadata to include in the digest
 * @returns Hex-encoded signature digest
 */
export function createSignatureDigest(
  dataHash: string,
  signatureCustom?: Record<string, any>
): string {
  const serializedCustom = signatureCustom
    ? serializeData(signatureCustom)
    : "";
  return crypto
    .createHash(HASHING_ALGORITHM)
    .update(dataHash + serializedCustom)
    .digest("hex");
}
