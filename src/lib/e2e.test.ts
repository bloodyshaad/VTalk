// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  initLocalKeyPair,
  getLocalPublicKey,
  encryptForPeer,
  decryptFromPeer,
  encryptWithKeys,
  decryptWithKeys,
  packPayload,
  unpackPayload,
} from "./e2e";
import { generateX25519KeyPair } from "./x25519";

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

describe("E2E message encryption", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("two-party round-trip with explicit keys", () => {
    it("Alice can send a message Bob decrypts, and vice versa", async () => {
      const alice = generateX25519KeyPair();
      const bob = generateX25519KeyPair();

      const enc = await encryptWithKeys("hello bob 🔐", bob.publicKey, alice.privateKey);
      const dec = await decryptWithKeys(enc.ciphertext, enc.nonce, alice.publicKey, bob.privateKey);
      expect(dec).toBe("hello bob 🔐");

      const reply = await encryptWithKeys("hi alice", alice.publicKey, bob.privateKey);
      const decReply = await decryptWithKeys(reply.ciphertext, reply.nonce, bob.publicKey, alice.privateKey);
      expect(decReply).toBe("hi alice");
    });

    it("decrypting with the wrong recipient key fails", async () => {
      const alice = generateX25519KeyPair();
      const bob = generateX25519KeyPair();
      const eve = generateX25519KeyPair();

      const enc = await encryptWithKeys("secret", bob.publicKey, alice.privateKey);
      await expect(
        decryptWithKeys(enc.ciphertext, enc.nonce, alice.publicKey, eve.privateKey),
      ).rejects.toBeTruthy();
    });

    it("tampered ciphertext fails authentication", async () => {
      const alice = generateX25519KeyPair();
      const bob = generateX25519KeyPair();
      const enc = await encryptWithKeys("integrity", bob.publicKey, alice.privateKey);
      const tampered = enc.ciphertext.slice(0, -2) + (enc.ciphertext.endsWith("A") ? "B" : "A");
      await expect(
        decryptWithKeys(tampered, enc.nonce, alice.publicKey, bob.privateKey),
      ).rejects.toBeTruthy();
    });
  });

  describe("browser key persistence (localStorage)", () => {
    it("round-trips through the persisted-key API", async () => {
      const alicePub = await initLocalKeyPair();
      const bobPub = await initLocalKeyPair(); // overwrites the single browser slot
      // Self-encrypt with the persisted (bob) key proves encrypt+decrypt symmetry.
      const enc = await encryptForPeer("self test", bobPub);
      const dec = await decryptFromPeer(enc.ciphertext, enc.nonce, bobPub);
      expect(dec).toBe("self test");
    });

    it("getLocalPublicKey errors when no key is initialized", async () => {
      await expect(getLocalPublicKey()).rejects.toThrow(/not initialized/);
    });
  });

  describe("payload packing", () => {
    it("packs and unpacks payloads", () => {
      const ct = toBase64(new Uint8Array([1, 2, 3]));
      const nonce = toBase64(new Uint8Array([4, 5, 6]));
      const packed = packPayload(ct, nonce);
      expect(packed).toBe(`${ct}.${nonce}`);
      expect(unpackPayload(packed)).toEqual({ ciphertext: ct, nonce });
    });

    it("unpackPayload returns null for malformed input", () => {
      expect(unpackPayload("no-dot-here")).toBeNull();
    });
  });
});
