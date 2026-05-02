declare const process: any;
declare const Buffer: any;

declare module "node:crypto" {
  export function randomUUID(): string;
  export function createHmac(algorithm: string, secret: string): {
    update(input: string): {
      digest(encoding: "hex"): string;
    };
  };
  export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean;
}
