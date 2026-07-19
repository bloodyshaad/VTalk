use x25519_dalek::{PublicKey, StaticSecret};

/// Generate a fresh X25519 key pair.
/// Returns (public_key_bytes, private_key_bytes) as raw 32-byte arrays.
pub fn generate_key_pair() -> (Vec<u8>, Vec<u8>) {
    let secret = StaticSecret::random_from_rng(rand::thread_rng());
    let public = PublicKey::from(&secret);
    (public.as_bytes().to_vec(), secret.to_bytes().to_vec())
}

/// Derive the shared secret (used for E2E key exchange) from our private key
/// and the recipient's public key, then return the raw bytes for use as an
/// AES key seed.
pub fn derive_shared_secret(our_private: &[u8], their_public: &[u8]) -> Result<Vec<u8>, String> {
    if our_private.len() != 32 || their_public.len() != 32 {
        return Err("invalid key length".to_string());
    }
    let secret = StaticSecret::from(<[u8; 32]>::try_from(our_private).unwrap());
    let public = PublicKey::from(<[u8; 32]>::try_from(their_public).unwrap());
    let shared = secret.diffie_hellman(&public);
    Ok(shared.as_bytes().to_vec())
}

/// Reconstruct a public key from raw bytes.
pub fn public_key_from_bytes(bytes: &[u8]) -> Result<PublicKey, String> {
    if bytes.len() != 32 {
        return Err("public key must be 32 bytes".to_string());
    }
    Ok(PublicKey::from(<[u8; 32]>::try_from(bytes).unwrap()))
}
