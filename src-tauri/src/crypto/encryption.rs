use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use sha2::{Digest, Sha256};

/// Encrypt plaintext with AES-256-GCM using a 32-byte key derived from the
/// shared secret. Returns (ciphertext, nonce) both as raw bytes.
pub fn encrypt(shared_secret: &[u8], plaintext: &[u8]) -> Result<(Vec<u8>, Vec<u8>), String> {
    let key = derive_key(shared_secret);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|e| format!("encryption failed: {e}"))?;
    Ok((ciphertext, nonce.to_vec()))
}

/// Decrypt ciphertext with AES-256-GCM.
pub fn decrypt(shared_secret: &[u8], ciphertext: &[u8], nonce: &[u8]) -> Result<Vec<u8>, String> {
    let key = derive_key(shared_secret);
    let cipher = Aes256Gcm::new_from_slice(&key).map_err(|e| e.to_string())?;
    let nonce_array = Nonce::from_slice(nonce);
    let plaintext = cipher
        .decrypt(nonce_array, ciphertext)
        .map_err(|e| format!("decryption failed: {e}"))?;
    Ok(plaintext)
}

/// Derive a 32-byte AES key from an arbitrary shared secret via SHA-256.
fn derive_key(shared_secret: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(shared_secret);
    hasher.update(b"vtalk-aes-256-gcm");
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}
