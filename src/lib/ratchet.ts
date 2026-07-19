/**
 * Double-ratchet message encryption (TypeScript port).
 *
 * Mirrors the Rust implementation in `src-tauri/src/crypto/ratchet.rs` byte for
 * byte so a message encrypted on the native (Rust) side decrypts on the browser
 * side and vice versa. Algorithm summary:
 *
 *  - Root key `RK = HMAC(shared_secret, "root")`, identical on both sides
 *    (derived from the X25519 handshake output).
 *  - Send chain `HMAC(RK, "send")` and receive chain `HMAC(RK, "recv")`.
 *    Because both peers seed from the same `RK` with the same info tags,
 *    *Alice's send chain == Bob's receive chain* (and vice versa) — so a message
 *    encrypted on one side decrypts on the other with no key exchange.
 *  - Each message steps its chain with HMAC-SHA256, yielding a fresh
 *    single-use message key for one AES-256-GCM encryption. Leaking one message
 *    key cannot recover neighbouring messages (forward secrecy within a chain).
 *
 * This stops short of full X3DH (signed pre-key bundles, skipped-key queues
 * for out-of-order delivery) — those are deployment layers on top of this core.
 */

const INFO_ROOT = new TextEncoder().encode("vtalk-ratchet-root-v1");
const INFO_SEND = new TextEncoder().encode("vtalk-ratchet-send-v1");
const INFO_RECV = new TextEncoder().encode("vtalk-ratchet-recv-v1");
const MSG_KEY_INFO = new Uint8Array([0x01]);
const NEXT_CHAIN_INFO = new Uint8Array([0x02]);

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

async function hmac(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data as BufferSource);
  return new Uint8Array(sig);
}

/** HMAC(ikm, info) used as a single-step key-derivation / extract. */
async function derive(ikm: Uint8Array, info: Uint8Array): Promise<Uint8Array> {
  return hmac(ikm, info);
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", data as BufferSource);
  return new Uint8Array(digest);
}

export class Ratchet {
  private rootKey: Uint8Array;
  private sendChain: Uint8Array;
  private recvChain: Uint8Array;
  private sendCount = 0;
  private recvCount = 0;

  private constructor(rootKey: Uint8Array, sendChain: Uint8Array, recvChain: Uint8Array) {
    this.rootKey = rootKey;
    this.sendChain = sendChain;
    this.recvChain = recvChain;
  }

  /**
   * Build a ratchet from the X25519 shared secret (identical on both peers).
   * `isInitiator` sets chain orientation: the initiator's send chain is the
   * responder's receive chain, so a message encrypted by one decrypts on the
   * other. The caller (which knows both peer public keys) decides orientation,
   * e.g. initiator = the lexicographically-smaller public key.
   */
  static async create(
    sharedSecret: Uint8Array,
    isInitiator: boolean,
  ): Promise<Ratchet> {
    const rootKey = await derive(sharedSecret, INFO_ROOT);
    const sendChain = await derive(
      rootKey,
      isInitiator ? INFO_SEND : INFO_RECV,
    );
    const recvChain = await derive(
      rootKey,
      isInitiator ? INFO_RECV : INFO_SEND,
    );
    return new Ratchet(rootKey, sendChain, recvChain);
  }

  private async stepChain(chain: Uint8Array): Promise<[Uint8Array, Uint8Array]> {
    const msgKey = await hmac(chain, MSG_KEY_INFO);
    const nextChain = await hmac(chain, NEXT_CHAIN_INFO);
    return [msgKey, nextChain];
  }

  private async aesKey(msgKey: Uint8Array): Promise<CryptoKey> {
    const digest = await sha256(
      concat(msgKey, new TextEncoder().encode("vtalk-aes-256-gcm")),
    );
    return crypto.subtle.importKey(
      "raw",
      digest as BufferSource,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  }

  async encrypt(plaintext: string): Promise<{ ciphertext: string; nonce: string }> {
    const [msgKey, nextChain] = await this.stepChain(this.sendChain);
    this.sendChain = nextChain;
    const key = await this.aesKey(msgKey);
    const nonce = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      key,
      new TextEncoder().encode(plaintext) as BufferSource,
    );
    this.sendCount += 1;
    return {
      ciphertext: b64encode(new Uint8Array(ct)),
      nonce: b64encode(nonce),
    };
  }

  async decrypt(ciphertextB64: string, nonceB64: string): Promise<string> {
    const [msgKey, nextChain] = await this.stepChain(this.recvChain);
    this.recvChain = nextChain;
    const key = await this.aesKey(msgKey);
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64decode(nonceB64) as BufferSource },
      key,
      b64decode(ciphertextB64) as BufferSource,
    );
    this.recvCount += 1;
    return new TextDecoder().decode(pt);
  }

  async safetyNumber(): Promise<string> {
    const digest = await sha256(this.rootKey);
    const slice = digest.slice(0, 10);
    let out = "";
    for (let i = 0; i < slice.length; i++) {
      if (i > 0 && i % 2 === 0) out += "-";
      out += slice[i].toString(16).padStart(2, "0").toUpperCase();
    }
    return out;
  }
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
