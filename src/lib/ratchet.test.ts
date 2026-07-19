// @vitest-environment node
import { describe, it, expect } from "vitest";
import { Ratchet } from "./ratchet";
import { generateX25519KeyPair, x25519SharedSecret } from "./x25519";

function sharedBetween(): [Uint8Array, Uint8Array] {
  const a = generateX25519KeyPair();
  const b = generateX25519KeyPair();
  const sa = x25519SharedSecret(a.privateKey, b.publicKey);
  const sb = x25519SharedSecret(b.privateKey, a.publicKey);
  return [sa, sb];
}

describe("double ratchet (browser)", () => {
  it("round-trips a sequence of messages with forward chain rotation", async () => {
    const [sa, sb] = sharedBetween();
    const alice = await Ratchet.create(sa, true);
    const bob = await Ratchet.create(sb, false);

    const m1 = await alice.encrypt("hello 1");
    const m2 = await alice.encrypt("hello 2");
    const m3 = await alice.encrypt("hello 3");

    expect(await bob.decrypt(m1.ciphertext, m1.nonce)).toBe("hello 1");
    expect(await bob.decrypt(m2.ciphertext, m2.nonce)).toBe("hello 2");
    expect(await bob.decrypt(m3.ciphertext, m3.nonce)).toBe("hello 3");
  });

  it("safety numbers match for both peers (verifiable out-of-band)", async () => {
    const [sa, sb] = sharedBetween();
    const alice = await Ratchet.create(sa, true);
    const bob = await Ratchet.create(sb, false);
    expect(await alice.safetyNumber()).toBe(await bob.safetyNumber());
    expect(await alice.safetyNumber()).toMatch(/^[0-9A-F-]+$/);
  });

  it("fails to decrypt tampered ciphertext", async () => {
    const [sa, sb] = sharedBetween();
    const alice = await Ratchet.create(sa, true);
    const bob = await Ratchet.create(sb, false);
    const m = await alice.encrypt("integrity");
    const ct = b64ToBytes(m.ciphertext);
    ct[0] ^= 0xff;
    const tampered = bytesToB64(ct);
    await expect(bob.decrypt(tampered, m.nonce)).rejects.toBeTruthy();
  });

  it("different shared secrets produce different safety numbers", async () => {
    const [sa] = sharedBetween();
    const [sc] = sharedBetween();
    const a = await Ratchet.create(sa, true);
    const c = await Ratchet.create(sc, true);
    expect(await a.safetyNumber()).not.toBe(await c.safetyNumber());
  });

  it("decrypting out of send order fails (chain alignment)", async () => {
    const [sa, sb] = sharedBetween();
    const alice = await Ratchet.create(sa, true);
    const bob = await Ratchet.create(sb, false);
    await alice.encrypt("one");
    const m2 = await alice.encrypt("two");
    // Bob skipped message 1, so his receive chain is one step behind.
    await expect(bob.decrypt(m2.ciphertext, m2.nonce)).rejects.toBeTruthy();
  });
});

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function bytesToB64(b: Uint8Array): string {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}
