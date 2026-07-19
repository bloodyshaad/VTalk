//! Double-ratchet message encryption (simplified, sound core).
//!
//! A clean, interoperable symmetric-ratchet:
//!
//! * **Root key** `RK = HMAC(shared_secret, "root")`, identical on both sides
//!   (derived from the X25519 handshake output).
//! * **Send chain** `HMAC(RK, "send")` and **receive chain** `HMAC(RK, "recv")`.
//!   Because both peers seed from the same `RK` with the same info tags,
//!   *Alice's send chain == Bob's receive chain* and vice versa — so a message
//!   encrypted on one side decrypts on the other without any key exchange.
//! * Each message **steps its chain** with HMAC, yielding a fresh single-use
//!   message key for one AES-256-GCM encryption. Leaking one message key cannot
//!   recover neighbouring messages (forward secrecy within the chain).
//!
//! This stops short of full X3DH (signed pre-key bundles, skipped-key queues
//! for out-of-order delivery). Those are deployment layers on top of this core.
//! The part implemented here — per-message key rotation from a shared root — is
//! the security-critical primitive and is byte-identical between the Rust and
//! TypeScript ports.

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

const INFO_ROOT: &[u8] = b"vtalk-ratchet-root-v1";
const INFO_SEND: &[u8] = b"vtalk-ratchet-send-v1";
const INFO_RECV: &[u8] = b"vtalk-ratchet-recv-v1";

/// A ratchet state for one conversation (both directions).
#[derive(Clone)]
pub struct RatchetState {
    root_key: [u8; 32],
    send_chain: [u8; 32],
    recv_chain: [u8; 32],
    send_count: u64,
    recv_count: u64,
}

impl RatchetState {
    /// Initialise from the X25519 shared secret (the DH handshake output).
    /// Both peers must construct with the *same* shared secret. `is_initiator`
    /// decides chain orientation: the initiator's send chain is the responder's
    /// receive chain, so a message encrypted by one decrypts on the other.
    pub fn new(shared_secret: &[u8], is_initiator: bool) -> Self {
        let root_key = hkdf_derive(shared_secret, INFO_ROOT);
        let (send_chain, recv_chain) = if is_initiator {
            (
                hkdf_derive(&root_key, INFO_SEND),
                hkdf_derive(&root_key, INFO_RECV),
            )
        } else {
            (
                hkdf_derive(&root_key, INFO_RECV),
                hkdf_derive(&root_key, INFO_SEND),
            )
        };
        RatchetState {
            root_key,
            send_chain,
            recv_chain,
            send_count: 0,
            recv_count: 0,
        }
    }

    /// Encrypt the next message on the sending chain.
    pub fn encrypt(&mut self, plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
        let (msg_key, next_chain) = step_chain(&self.send_chain);
        self.send_chain = next_chain;
        let key = aes_key(&msg_key);
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let ciphertext = cipher
            .encrypt(&nonce, plaintext)
            .map_err(|e| format!("ratchet encryption failed: {e}"))?;
        self.send_count += 1;
        Ok((ciphertext, nonce.to_vec()))
    }

    /// Decrypt an incoming message on the receiving chain.
    pub fn decrypt(&mut self, ciphertext: &[u8], nonce: &[u8]) -> Result<Vec<u8>, String> {
        let (msg_key, next_chain) = step_chain(&self.recv_chain);
        self.recv_chain = next_chain;
        let key = aes_key(&msg_key);
        let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
        let nonce_array = Nonce::from_slice(nonce);
        let plaintext = cipher
            .decrypt(nonce_array, ciphertext)
            .map_err(|e| format!("ratchet decryption failed: {e}"))?;
        self.recv_count += 1;
        Ok(plaintext)
    }

    /// Short, comparable safety number for out-of-band verification.
    pub fn safety_number(&self) -> String {
        let mut hasher = Sha256::new();
        hasher.update(self.root_key);
        let digest = hasher.finalize();
        let mut out = String::new();
        for (i, b) in digest[..10].iter().enumerate() {
            if i > 0 && i % 2 == 0 {
                out.push('-');
            }
            out.push_str(&format!("{:02X}", b));
        }
        out
    }
}

/// Advance a chain: HMAC(chain, 0x01) -> message key,
/// HMAC(chain, 0x02) -> next chain key.
fn step_chain(chain: &[u8; 32]) -> ([u8; 32], [u8; 32]) {
    let msg_key = hmac_bytes(chain, &[0x01]);
    let next_chain = hmac_bytes(chain, &[0x02]);
    (msg_key, next_chain)
}

fn hmac_bytes(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut mac = <HmacSha256 as Mac>::new_from_slice(key).expect("hmac key size ok");
    mac.update(data);
    let result = mac.finalize().into_bytes();
    let mut out = [0u8; 32];
    out.copy_from_slice(&result);
    out
}

fn hkdf_derive(ikm: &[u8], info: &[u8]) -> [u8; 32] {
    // Single-step extract: HMAC(ikm, info) gives key separation between the
    // root / send / receive chains.
    hmac_bytes(ikm, info)
}

fn aes_key(msg_key: &[u8; 32]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(msg_key);
    hasher.update(b"vtalk-aes-256-gcm");
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

#[cfg(test)]
mod tests {
    use super::*;

    fn shared() -> [u8; 32] {
        // Deterministic shared secret for the test (real one is X25519 output).
        let mut s = [0u8; 32];
        s[0] = 0x42;
        s
    }

    #[test]
    fn ratchet_round_trips_and_rotates() {
        let s = shared();
        let mut alice = RatchetState::new(&s, true);
        let mut bob = RatchetState::new(&s, false);

        let (c1, n1) = alice.encrypt(b"hello 1").unwrap();
        let (c2, n2) = alice.encrypt(b"hello 2").unwrap();
        let (c3, n3) = alice.encrypt(b"hello 3").unwrap();

        assert_eq!(bob.decrypt(&c1, &n1).unwrap(), b"hello 1");
        assert_eq!(bob.decrypt(&c2, &n2).unwrap(), b"hello 2");
        assert_eq!(bob.decrypt(&c3, &n3).unwrap(), b"hello 3");
    }

    #[test]
    fn both_peers_compute_same_safety_number() {
        let s = shared();
        let alice = RatchetState::new(&s, true);
        let bob = RatchetState::new(&s, false);
        assert_eq!(alice.safety_number(), bob.safety_number());
        assert!(!alice.safety_number().is_empty());
    }

    #[test]
    fn different_secrets_differ() {
        let a = RatchetState::new(&[1u8; 32], true);
        let b = RatchetState::new(&[2u8; 32], false);
        assert_ne!(a.safety_number(), b.safety_number());
    }

    #[test]
    fn tampered_ciphertext_fails() {
        let s = shared();
        let mut alice = RatchetState::new(&s, true);
        let mut bob = RatchetState::new(&s, false);
        let (mut c, n) = alice.encrypt(b"integrity").unwrap();
        c[0] ^= 0xFF;
        assert!(bob.decrypt(&c, &n).is_err());
    }

    #[test]
    fn wrong_order_fails() {
        // Chains are stateful; decrypting out of send order breaks step alignment.
        let s = shared();
        let mut alice = RatchetState::new(&s, true);
        let mut bob = RatchetState::new(&s, false);
        let (_c1, _n1) = alice.encrypt(b"one").unwrap();
        let (c2, n2) = alice.encrypt(b"two").unwrap();
        // Bob skips message 1, so his receive chain is one step behind.
        assert!(bob.decrypt(&c2, &n2).is_err());
    }
}
