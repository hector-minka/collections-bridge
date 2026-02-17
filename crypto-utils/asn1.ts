/**
 * ASN1 prefix which precedes the private key in DER ASN.1 format.
 * Contains identifiers for Ed25519 together with meta bytes
 * for length and others.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8410
 * @see https://datatracker.ietf.org/doc/html/rfc5208
 * @see example https://lapo.it/asn1js/#MCowBQYDK2VwAyEAYNUhOe_8hqFet7VdDSO4372OFw0whAWJ8VAlPPXAPGY
 */
export const ASN1_PRIVATE_PREFIX = "302e020100300506032b657004220420";

/**
 * ASN1 prefix which precedes the public key in
 * Contains identifiers for Ed25519 together with meta bytes
 * for length and others.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8410
 * @see https://datatracker.ietf.org/doc/html/rfc5208
 * @see example https://lapo.it/asn1js/#MC4CAQAwBQYDK2VwBCIEIM6DAyVnD64eFWkToBL_uYqsTzKe4qasTvu5xnJrRhHF
 */
export const ASN1_PUBLIC_PREFIX = "302a300506032b6570032100";

/**
 * Converts raw private key to `der` format.
 *
 * @param keyHex hex encoded raw private key
 * @returns hex encoded private key in `der` format
 * @throws if input key has wrong length
 */
export function privateKeyEd25519RawToDer(keyHex: string): string {
  if (keyHex.length != 64) {
    throw new Error(
      `Unexpected raw private key length in hex ${keyHex.length}, expected 64`
    );
  }

  // Prepend the ASN.1 prefix to raw key data
  return `${ASN1_PRIVATE_PREFIX}${keyHex}`;
}

/**
 * Converts raw public key to `der` format.
 *
 * @param keyHex hex encoded raw public key
 * @returns hex encoded public key in `der` format
 * @throws if input key has wrong length
 */
export function publicKeyEd25519RawToDer(keyHex: string): string {
  if (keyHex.length != 64) {
    throw new Error(
      `Unexpected raw public key length in hex ${keyHex.length}, expected 64`
    );
  }

  // Prepend the ASN.1 prefix to raw key data
  return `${ASN1_PUBLIC_PREFIX}${keyHex}`;
}
