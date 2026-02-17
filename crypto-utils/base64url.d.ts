declare module 'base64url' {
  export function encode(data: string | Buffer): string;
  export function decode(data: string): string;
  export function toBase64(data: string): string;
  export function fromBase64(data: string): string;
  export function toBuffer(data: string): Buffer;
  export function fromBuffer(data: Buffer): string;
  const base64url: {
    encode: (data: string | Buffer) => string;
    decode: (data: string) => string;
    toBase64: (data: string) => string;
    fromBase64: (data: string) => string;
    toBuffer: (data: string) => Buffer;
    fromBuffer: (data: Buffer) => string;
  };
  export default base64url;
}
