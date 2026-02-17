import { LedgerJWTPayload } from "@minka/ledger-sdk/types";
import isNode from "detect-node";
import { SignJWT } from "jose";
// @ts-ignore
import * as ed25519 from "@noble/ed25519";
import base64url from "base64url";
import { importPrivateKey } from "./keys";

/**
 * Signs a JWT token for ledger authentication.
 * Uses Ed25519 algorithm to sign the token with the provided secret key.
 * 
 * @param payload - JWT payload containing issuer, subject, audience, etc.
 * @param secretKey - Base64-encoded raw Ed25519 private key
 * @param kid - Optional public key identifier (kid)
 * @returns Signed JWT token string
 */
export async function signJWT(
  payload: LedgerJWTPayload,
  secretKey: string,
  kid?: string
): Promise<string> {
  // Ensure kid is a string (fallback to empty string if undefined)
  const kidStr = kid || "";
  return isNode
    ? signJWTNode(payload, secretKey, kidStr)
    : signJWTBrowser(payload, secretKey, kidStr);
}

/**
 * Signs a JWT token in Node.js environment
 */
async function signJWTNode(
  payload: LedgerJWTPayload,
  secretKey: string,
  kid: string
): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "EdDSA", kid })
    .sign(importPrivateKey(secretKey));
}

/**
 * Signs a JWT token in browser environment
 */
async function signJWTBrowser(
  payload: LedgerJWTPayload,
  secretKey: string,
  kid: string
): Promise<string> {
  const header = { alg: "EdDSA", kid };
  const payloadEncoded = base64url.encode(JSON.stringify(payload));
  const headerEncoded = base64url.encode(JSON.stringify(header));

  // Concatenate header and payload with a dot
  const data = `${headerEncoded}.${payloadEncoded}`;

  // Sign the data (as Uint8Array)
  const privateKey = Buffer.from(secretKey, "base64");
  try {
    const signature = await ed25519.sign(Buffer.from(data), privateKey);
    const encodedSignature = base64url.encode(Buffer.from(signature));
    return `${headerEncoded}.${payloadEncoded}.${encodedSignature}`;
  } catch (error: any) {
    if (error.message === "Expected 32 bytes") {
      const publicLength = Buffer.from(secretKey, "base64").toString("hex").length;
      throw new Error(
        `Unexpected raw private key length in hex ${publicLength}, expected 64`
      );
    }
    throw new Error("jwt signing failed");
  }
}
