//! OS-backed secure storage for the E2E private key.
//!
//! The X25519 private key is secret. Storing it in the Tauri `store` plugin
//! would write it to a plaintext JSON file on disk, readable by any process with
//! filesystem access. Instead we use the OS credential store (Windows Credential
//! Manager, macOS Keychain, Linux libsecret via secret-service) through the
//! `keyring` crate. The public key is NOT secret and may stay in the normal
//! store / Supabase profile.

use base64::Engine;
use keyring::Entry;

const SERVICE: &str = "vtalk-e2e";
const PRIVATE_USER: &str = "private-key";

/// Persist the private key (raw 32 bytes) to the OS credential store.
pub fn store_private_key(key: &[u8]) -> Result<(), String> {
    let entry = Entry::new(SERVICE, PRIVATE_USER).map_err(|e| format!("keyring: {e}"))?;
    let encoded = base64::engine::general_purpose::STANDARD.encode(key);
    entry
        .set_password(&encoded)
        .map_err(|e| format!("failed to store private key in OS keychain: {e}"))
}

/// Read the private key from the OS credential store.
pub fn get_private_key() -> Result<Vec<u8>, String> {
    let entry = Entry::new(SERVICE, PRIVATE_USER).map_err(|e| format!("keyring: {e}"))?;
    let encoded = entry
        .get_password()
        .map_err(|_| "no private key in OS keychain; generate a key pair first")?;
    base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|e| format!("corrupt private key in OS keychain: {e}"))
}

/// Remove the private key (e.g. on "reset keys"). Best-effort.
pub fn delete_private_key() -> Result<(), String> {
    let entry = Entry::new(SERVICE, PRIVATE_USER).map_err(|e| format!("keyring: {e}"))?;
    let _ = entry.delete_credential();
    Ok(())
}
