import { describe, it, expect } from "vitest";
import { generateX25519KeyPair, x25519SharedSecret } from "./x25519";

describe("X25519 key agreement", () => {
  it("produces 32-byte keys", () => {
    const a = generateX25519KeyPair();
    expect(a.privateKey).toHaveLength(32);
    expect(a.publicKey).toHaveLength(32);
  });

  it("is commutative: shared secret is identical for both peers", () => {
    const alice = generateX25519KeyPair();
    const bob = generateX25519KeyPair();

    const aliceSees = x25519SharedSecret(alice.privateKey, bob.publicKey);
    const bobSees = x25519SharedSecret(bob.privateKey, alice.publicKey);

    expect(aliceSees).toEqual(bobSees);
    expect(aliceSees).toHaveLength(32);
  });

  it("yields a different secret for a different peer", () => {
    const alice = generateX25519KeyPair();
    const bob = generateX25519KeyPair();
    const carol = generateX25519KeyPair();

    const withBob = x25519SharedSecret(alice.privateKey, bob.publicKey);
    const withCarol = x25519SharedSecret(alice.privateKey, carol.publicKey);

    expect(withBob).not.toEqual(withCarol);
  });

  it("is deterministic for the same inputs", () => {
    const a = generateX25519KeyPair();
    const b = generateX25519KeyPair();
    const s1 = x25519SharedSecret(a.privateKey, b.publicKey);
    const s2 = x25519SharedSecret(a.privateKey, b.publicKey);
    expect(s1).toEqual(s2);
  });
});
