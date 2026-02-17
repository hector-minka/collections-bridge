import { KeyObject, createPrivateKey, createPublicKey } from "crypto";
import { privateKeyEd25519RawToDer, publicKeyEd25519RawToDer } from "./asn1";

type PublicKeyParser = {
  [key: string]: (keyHex: string) => string;
};

const publicKeyParser: PublicKeyParser = {
  "ed25519-raw": publicKeyEd25519RawToDer,
  "rsa-der": (keyHex: string) => keyHex,
};

/**
 * Imports public `der` key from raw key format
 * @param key public key in base64 raw format
 * @param format key format (default: "ed25519-raw")
 * @returns public key as KeyObject in `der` format
 */
export function importPublicKey(
  key: string,
  format = "ed25519-raw"
): KeyObject {
  const keyHex = Buffer.from(key, "base64").toString("hex");
  const parser = publicKeyParser[format];
  if (!parser) {
    throw new Error(`Unknown public key format: ${format}`);
  }
  return createPublicKey({
    format: "der",
    type: "spki",
    key: Buffer.from(parser(keyHex), "hex"),
  });
}

/**
 * Imports private `der` key from raw key format.
 * Converts a base64-encoded raw Ed25519 private key to a Node.js KeyObject.
 * 
 * @param key private key in base64 raw format
 * @returns private key as KeyObject in `der` format
 */
export function importPrivateKey(key: string): KeyObject {
  const keyHex = Buffer.from(key, "base64").toString("hex");
  return createPrivateKey({
    format: "der",
    type: "pkcs8",
    key: Buffer.from(privateKeyEd25519RawToDer(keyHex), "hex"),
  });
}
