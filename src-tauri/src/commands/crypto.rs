use crate::config::auth::{SESSION_STORE};
use crate::crypto;
use crate::crypto::keychain;
use crate::crypto::ratchet::RatchetState;
use base64::engine::general_purpose::STANDARD as B64;
use base64::Engine;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use tauri_plugin_store::StoreExt;

/// In-memory per-chat ratchet states, keyed by `chat_id`.
/// In a production app this would be persisted encrypted at rest; here it lives
/// for the session and is seeded from the X25519 shared secret per chat.
static RATCHETS: LazyLock<Mutex<HashMap<String, RatchetState>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

const PUBLIC_KEY_KEY: &str = "e2e_public_key";

#[derive(serde::Serialize)]
pub struct KeyPair {
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
}

#[tauri::command]
pub fn generate_key_pair() -> Result<KeyPair, String> {
    let (public, private) = crypto::key_manager::generate_key_pair();
    Ok(KeyPair {
        public_key: public,
        private_key: private,
    })
}

/// Persist the private key to the OS credential store (NOT the plaintext
/// `store` plugin file). The key never touches disk in cleartext.
#[tauri::command]
pub fn store_private_key(key: Vec<u8>) -> Result<(), String> {
    keychain::store_private_key(&key)
}

/// Read the private key from the OS credential store.
#[tauri::command]
pub fn get_private_key() -> Result<Vec<u8>, String> {
    keychain::get_private_key()
}

#[tauri::command]
pub fn delete_private_key() -> Result<(), String> {
    keychain::delete_private_key()
}

#[tauri::command]
pub fn get_public_key(app: tauri::AppHandle) -> Result<Vec<u8>, String> {
    // The public key is not secret; it is cached here and also published to the
    // Supabase `profiles.public_key` column for peers to fetch.
    let store = app
        .store(SESSION_STORE)
        .map_err(|e| format!("store error: {e}"))?;
    match store.get(PUBLIC_KEY_KEY) {
        Some(v) => {
            let b64 = v.as_str().ok_or("invalid public key stored")?;
            B64.decode(b64).map_err(|e| e.to_string())
        }
        None => Err("no public key stored".to_string()),
    }
}

/// Cache the public key in the (non-secret) store. The private key is handled
/// separately via the OS keychain.
#[tauri::command]
pub fn store_public_key(app: tauri::AppHandle, key: Vec<u8>) -> Result<(), String> {
    let store = app
        .store(SESSION_STORE)
        .map_err(|e| format!("store error: {e}"))?;
    let public_b64 = B64.encode(&key);
    store.set(PUBLIC_KEY_KEY, serde_json::Value::String(public_b64));
    store.save().map_err(|e| e.to_string())
}

#[derive(serde::Serialize)]
pub struct EncryptedMessage {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

#[tauri::command]
pub fn encrypt_message(
    plaintext: String,
    recipient_public_key: Vec<u8>,
) -> Result<EncryptedMessage, String> {
    let private = keychain::get_private_key()?;
    let shared = crypto::key_manager::derive_shared_secret(&private, &recipient_public_key)?;
    let (ciphertext, nonce) = crypto::encryption::encrypt(&shared, plaintext.as_bytes())?;
    Ok(EncryptedMessage { ciphertext, nonce })
}

#[tauri::command]
pub fn decrypt_message(
    ciphertext: Vec<u8>,
    nonce: Vec<u8>,
    sender_public_key: Vec<u8>,
) -> Result<String, String> {
    let private = keychain::get_private_key()?;
    let shared = crypto::key_manager::derive_shared_secret(&private, &sender_public_key)?;
    let plaintext = crypto::encryption::decrypt(&shared, &ciphertext, &nonce)?;
    String::from_utf8(plaintext).map_err(|e| format!("invalid utf-8: {e}"))
}

#[derive(serde::Serialize)]
pub struct RatchetEncrypted {
    pub ciphertext: Vec<u8>,
    pub nonce: Vec<u8>,
}

/// Initialise (or reseed) the per-chat ratchet from an X25519 shared secret
/// (the DH handshake output). Idempotent per `chat_id`. Both peers must
/// initialise with the *same* shared secret. `is_initiator` sets chain
/// orientation so a message encrypted by one peer decrypts on the other.
#[tauri::command]
pub fn ratchet_init(
    chat_id: String,
    shared_secret_b64: String,
    is_initiator: bool,
) -> Result<(), String> {
    let secret = B64.decode(shared_secret_b64).map_err(|e| e.to_string())?;
    let mut map = RATCHETS.lock().map_err(|_| "ratchet map poisoned".to_string())?;
    map.insert(chat_id, RatchetState::new(&secret, is_initiator));
    Ok(())
}

/// Encrypt the next message on a chat's sending chain.
#[tauri::command]
pub fn ratchet_encrypt(
    chat_id: String,
    plaintext: String,
) -> Result<RatchetEncrypted, String> {
    let mut map = RATCHETS.lock().map_err(|_| "ratchet map poisoned".to_string())?;
    let state = map
        .get_mut(&chat_id)
        .ok_or("ratchet not initialised for this chat; call ratchet_init")?;
    let (ct, nonce) = state.encrypt(plaintext.as_bytes())?;
    Ok(RatchetEncrypted {
        ciphertext: ct,
        nonce,
    })
}

/// Decrypt an incoming message, advancing the receive chain.
#[tauri::command]
pub fn ratchet_decrypt(
    chat_id: String,
    ciphertext: Vec<u8>,
    nonce: Vec<u8>,
) -> Result<String, String> {
    let mut map = RATCHETS.lock().map_err(|_| "ratchet map poisoned".to_string())?;
    let state = map
        .get_mut(&chat_id)
        .ok_or("ratchet not initialised for this chat; call ratchet_init")?;
    let plaintext = state.decrypt(&ciphertext, &nonce)?;
    String::from_utf8(plaintext).map_err(|e| format!("invalid utf-8: {e}"))
}

/// Safety number for out-of-band verification of a chat's ratchet.
#[tauri::command]
pub fn ratchet_safety_number(chat_id: String) -> Result<String, String> {
    let map = RATCHETS.lock().map_err(|_| "ratchet map poisoned".to_string())?;
    let state = map
        .get(&chat_id)
        .ok_or("ratchet not initialised for this chat; call ratchet_init")?;
    Ok(state.safety_number())
}
