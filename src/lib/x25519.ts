/**
 * X25519 (Curve25519) key agreement wrapper around the audited `@noble/curves`
 * library. This produces byte-identical 32-byte public keys and shared secrets
 * to the native Rust backend (`x25519-dalek`), so E2E messages are fully
 * interoperable between the Tauri native app and the browser fallback.
 *
 * Public keys are exchanged as raw 32-byte little-endian values encoded in
 * base64 (identical to the Rust side).
 */

import { x25519 } from "@noble/curves/ed25519.js";

/** Generate a fresh X25519 key pair (raw 32-byte private + public). */
export function generateX25519KeyPair(): {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
} {
  const kp = x25519.keygen();
  // keygen() returns a 64-byte `${secret}||${public}` keypair. Split it.
  const privateKey = kp.secretKey;
  const publicKey = kp.publicKey;
  return { privateKey, publicKey };
}

/**
 * X25519 scalar multiplication. `scalar` is the 32-byte private key, `u` is the
 * peer's 32-byte u-coordinate. Returns the 32-byte shared secret.
 */
export function x25519SharedSecret(scalar: Uint8Array, u: Uint8Array): Uint8Array {
  return x25519.getSharedSecret(scalar, u);
}
