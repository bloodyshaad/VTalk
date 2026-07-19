/**
 * End-to-end encryption helpers.
 *
 * Both the native Tauri backend (Rust `x25519-dalek` + `aes-gcm`) and the
 * browser fallback use the **same** cryptographic primitives: X25519 (Curve
 * 25519) key agreement and AES-256-GCM. The browser implementation lives in
 * `x25519.ts` and produces byte-identical public keys and shared secrets to the
 * Rust side, so a message encrypted in one environment can be decrypted in the
 * other.
 *
 * Encrypted payloads are stored as base64 strings. The local public key is
 * published on the user's profile (`public_key` column, base64 of the raw
 * 32-byte X25519 public key).
 *
 * Key lifecycle: a keypair is generated exactly once (during onboarding) and
 * persisted. `getLocalPublicKey` only *reads* the existing key and never
 * silently generates a replacement — regenerating would irrevocably orphan all
 * previously-encrypted messages. A missing key is an explicit error that must
 * be handled by re-running key setup.
 */

import { generateX25519KeyPair, x25519SharedSecret } from "./x25519";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---- Persistent browser key (localStorage) --------------------------------

interface BrowserKey {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

const BROWSER_KEY_STORAGE = "vtalk_e2e_private_key";

function loadBrowserKey(): BrowserKey | null {
  const raw = localStorage.getItem(BROWSER_KEY_STORAGE);
  if (!raw) return null;
  try {
    const privateKey = fromBase64(raw);
    // Public key = X25519(private, base point 9), matching Rust derivation.
    const basePoint = new Uint8Array(32);
    basePoint[0] = 9;
    const publicKey = x25519SharedSecret(privateKey, basePoint);
    return { privateKey, publicKey };
  } catch {
    return null;
  }
}

function saveBrowserKey(key: BrowserKey): void {
  localStorage.setItem(BROWSER_KEY_STORAGE, toBase64(key.privateKey));
}

// ---- Shared secret + AES-GCM (Web Crypto, both environments) ---------------

async function deriveAesKey(sharedSecret: Uint8Array): Promise<CryptoKey> {
  // Mirror the Rust backend: SHA-256(shared_secret || "vtalk-aes-256-gcm").
  const enc = new TextEncoder();
  const salt = enc.encode("vtalk-aes-256-gcm");
  const data = new Uint8Array(sharedSecret.length + salt.length);
  data.set(sharedSecret, 0);
  data.set(salt, sharedSecret.length);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return crypto.subtle.importKey(
    "raw",
    digest,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

async function browserEncrypt(
  plaintext: string,
  theirPublic: Uint8Array,
  myPrivate: Uint8Array,
): Promise<{ ciphertext: string; nonce: string }> {
  const shared = x25519SharedSecret(myPrivate, theirPublic);
  const key = await deriveAesKey(shared);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce as BufferSource },
    key,
    new TextEncoder().encode(plaintext) as BufferSource,
  );
  return {
    ciphertext: toBase64(new Uint8Array(ct)),
    nonce: toBase64(nonce),
  };
}

async function browserDecrypt(
  ciphertextB64: string,
  nonceB64: string,
  theirPublic: Uint8Array,
  myPrivate: Uint8Array,
): Promise<string> {
  const shared = x25519SharedSecret(myPrivate, theirPublic);
  const key = await deriveAesKey(shared);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(nonceB64) as BufferSource },
    key,
    fromBase64(ciphertextB64) as BufferSource,
  );
  return new TextDecoder().decode(pt);
}

/**
 * Encrypt for a peer using explicit key material. Exposed for testing and for
 * callers that manage key material outside `localStorage` (e.g. the OS
 * keychain integration).
 */
export async function encryptWithKeys(
  plaintext: string,
  theirPublicKey: Uint8Array,
  myPrivateKey: Uint8Array,
): Promise<{ ciphertext: string; nonce: string }> {
  return browserEncrypt(plaintext, theirPublicKey, myPrivateKey);
}

/** Decrypt from a peer using explicit key material. @see encryptWithKeys */
export async function decryptWithKeys(
  ciphertextB64: string,
  nonceB64: string,
  theirPublicKey: Uint8Array,
  myPrivateKey: Uint8Array,
): Promise<string> {
  return browserDecrypt(ciphertextB64, nonceB64, theirPublicKey, myPrivateKey);
}

// ---- Native (Tauri) backend ------------------------------------------------

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

/** Read the persisted native public key or error if none exists. */
async function nativeGetPublicKey(): Promise<Uint8Array> {
  const pub = await tauriInvoke<number[]>("get_public_key");
  return new Uint8Array(pub);
}

// ---- Public API ------------------------------------------------------------

/**
 * Generate a fresh keypair and persist it. This must be called exactly once
 * during onboarding (or after an explicit "reset keys" action). It must NOT be
 * called as a side effect of reading the public key, to avoid orphaning
 * previously-encrypted messages.
 */
export async function initLocalKeyPair(): Promise<string> {
  if (isTauri) {
    const kp = await tauriInvoke<{ public_key: number[]; private_key: number[] }>(
      "generate_key_pair",
    );
    // Private key -> OS credential store (never plaintext on disk).
    await tauriInvoke("store_private_key", { key: kp.private_key });
    // Public key -> non-secret cache + published to Supabase profile.
    await tauriInvoke("store_public_key", { key: kp.public_key });
    return toBase64(new Uint8Array(kp.public_key));
  }
  const kp = generateX25519KeyPair();
  saveBrowserKey(kp);
  return toBase64(kp.publicKey);
}

/**
 * Return the local public key (base64). Errors if no key has been initialized,
 * rather than silently generating a new one.
 */
export async function getLocalPublicKey(): Promise<string> {
  if (isTauri) return toBase64(await nativeGetPublicKey());
  const key = loadBrowserKey();
  if (!key) throw new Error("E2E key pair not initialized");
  return toBase64(key.publicKey);
}

/** Read the persisted private key (base64). Errors if uninitialized. */
export async function getLocalPrivateKeyB64(): Promise<string> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const raw = (await invoke<number[]>("get_private_key")) as unknown as number[];
    return toBase64(new Uint8Array(raw));
  }
  const key = loadBrowserKey();
  if (!key) throw new Error("E2E key pair not initialized");
  return toBase64(key.privateKey);
}

export async function encryptForPeer(
  plaintext: string,
  theirPublicKeyB64: string,
): Promise<{ ciphertext: string; nonce: string }> {
  const theirPublic = fromBase64(theirPublicKeyB64);
  if (isTauri) {
    // Native path uses the Rust crypto backend (keeps key material in the
    // secure store; private key never crosses the bridge).
    const res = await tauriInvoke<{ ciphertext: number[]; nonce: number[] }>(
      "encrypt_message",
      { plaintext, recipient_public_key: Array.from(theirPublic) },
    );
    return {
      ciphertext: toBase64(new Uint8Array(res.ciphertext)),
      nonce: toBase64(new Uint8Array(res.nonce)),
    };
  }
  const me = loadBrowserKey();
  if (!me) throw new Error("E2E key pair not initialized");
  return browserEncrypt(plaintext, theirPublic, me.privateKey);
}

export async function decryptFromPeer(
  ciphertextB64: string,
  nonceB64: string,
  theirPublicKeyB64: string,
): Promise<string> {
  const theirPublic = fromBase64(theirPublicKeyB64);
  if (isTauri) {
    return tauriInvoke<string>("decrypt_message", {
      ciphertext: Array.from(fromBase64(ciphertextB64)),
      nonce: Array.from(fromBase64(nonceB64)),
      sender_public_key: Array.from(theirPublic),
    });
  }
  const me = loadBrowserKey();
  if (!me) throw new Error("E2E key pair not initialized");
  return browserDecrypt(ciphertextB64, nonceB64, theirPublic, me.privateKey);
}

/** Pack ciphertext + nonce into the single string stored in `content`. */
export function packPayload(ciphertextB64: string, nonceB64: string): string {
  return `${ciphertextB64}.${nonceB64}`;
}

export function unpackPayload(packed: string): { ciphertext: string; nonce: string } | null {
  const idx = packed.indexOf(".");
  if (idx < 0) return null;
  return { ciphertext: packed.slice(0, idx), nonce: packed.slice(idx + 1) };
}
