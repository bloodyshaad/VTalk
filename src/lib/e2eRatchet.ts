/**
 * Ratchet-backed E2E facade.
 *
 * Provides per-chat forward-secret message encryption using the double-ratchet
 * core (see `ratchet.ts` for the browser implementation, `src-tauri/.../ratchet.rs`
 * for the audited native one). The shared X25519 secret between the two chat
 * peers seeds the ratchet root key.
 *
 * In Tauri the ratchet state lives in the Rust process (private key never crosses
 * the bridge); in the browser it lives in an in-memory map. `getSafetyNumber`
 * exposes a short fingerprint both peers can compare out-of-band.
 */

import { x25519SharedSecret, generateX25519KeyPair } from "./x25519";
import { Ratchet } from "./ratchet";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64encode(b: Uint8Array): string {
  let bin = "";
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin);
}

// Browser-side per-chat ratchet cache.
const browserRatchets = new Map<string, Ratchet>();

/** Compute and register the per-chat ratchet from the peer's public key. */
export async function initChatRatchet(
  chatId: string,
  myPrivateKeyB64: string,
  peerPublicKeyB64: string,
): Promise<void> {
  const shared = x25519SharedSecret(b64decode(myPrivateKeyB64), b64decode(peerPublicKeyB64));
  // Orientation: the peer with the lexicographically-smaller public key is the
  // "initiator". Both sides compute the same boolean independently.
  const isInitiator = b64encode(b64decode(myPrivateKeyB64)) <= peerPublicKeyB64;
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    await invoke("ratchet_init", {
      chatId,
      sharedSecretB64: b64encode(shared),
      isInitiator,
    });
  } else {
    browserRatchets.set(chatId, await Ratchet.create(shared, isInitiator));
  }
}

export interface RatchetMessage {
  ciphertext: string;
  nonce: string;
}

export async function ratchetEncrypt(
  chatId: string,
  plaintext: string,
): Promise<RatchetMessage> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<RatchetMessage>("ratchet_encrypt", { chatId, plaintext });
  }
  const r = browserRatchets.get(chatId);
  if (!r) throw new Error("ratchet not initialised for this chat");
  return r.encrypt(plaintext);
}

export async function ratchetDecrypt(
  chatId: string,
  msg: RatchetMessage,
): Promise<string> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("ratchet_decrypt", {
      chatId,
      ciphertext: b64decode(msg.ciphertext),
      nonce: b64decode(msg.nonce),
    });
  }
  const r = browserRatchets.get(chatId);
  if (!r) throw new Error("ratchet not initialised for this chat");
  return r.decrypt(msg.ciphertext, msg.nonce);
}

export async function getSafetyNumber(chatId: string): Promise<string> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<string>("ratchet_safety_number", { chatId });
  }
  const r = browserRatchets.get(chatId);
  if (!r) throw new Error("ratchet not initialised for this chat");
  return r.safetyNumber();
}

/** Generate a fresh keypair (used if the user resets their identity). */
export function newIdentityKeyPair(): { privateKeyB64: string; publicKeyB64: string } {
  const kp = generateX25519KeyPair();
  return {
    privateKeyB64: b64encode(kp.privateKey),
    publicKeyB64: b64encode(kp.publicKey),
  };
}
