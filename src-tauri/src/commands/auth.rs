use crate::config::auth::{SESSION_KEY, SESSION_STORE};
use tauri_plugin_store::StoreExt;

#[tauri::command]
pub fn store_session(
    app: tauri::AppHandle,
    access_token: String,
    refresh_token: String,
) -> Result<(), String> {
    let store = app
        .store(SESSION_STORE)
        .map_err(|e| format!("failed to open store: {e}"))?;
    let payload = serde_json::json!({
        "access": access_token,
        "refresh": refresh_token,
    });
    store.set(SESSION_KEY, payload);
    store
        .save()
        .map_err(|e| format!("failed to persist session: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn get_session(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let store = app
        .store(SESSION_STORE)
        .map_err(|e| format!("failed to open store: {e}"))?;
    Ok(store
        .get(SESSION_KEY)
        .and_then(|v| v.as_str().map(|s| s.to_string())))
}

#[tauri::command]
pub fn clear_session(app: tauri::AppHandle) -> Result<(), String> {
    let store = app
        .store(SESSION_STORE)
        .map_err(|e| format!("failed to open store: {e}"))?;
    store.delete(SESSION_KEY);
    store
        .save()
        .map_err(|e| format!("failed to persist session: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn has_session(app: tauri::AppHandle) -> Result<bool, String> {
    let store = app
        .store(SESSION_STORE)
        .map_err(|e| format!("failed to open store: {e}"))?;
    Ok(store
        .get(SESSION_KEY)
        .map(|v| !v.is_null())
        .unwrap_or(false))
}
