use crate::desktop_service::sync_manager::SyncManager;
use tauri::Manager;

#[derive(Serialize)]
pub struct SyncStatusOut {
    pub status: String,
    pub running: bool,
    pub pending: usize,
}

#[tauri::command]
pub async fn start_background_sync(app: tauri::AppHandle) -> Result<(), String> {
    let mgr = app.state::<SyncManager>();
    mgr.start();
    Ok(())
}

#[tauri::command]
pub async fn stop_background_sync(app: tauri::AppHandle) -> Result<(), String> {
    let mgr = app.state::<SyncManager>();
    mgr.stop();
    Ok(())
}

#[tauri::command]
pub async fn get_sync_status(app: tauri::AppHandle) -> Result<SyncStatusOut, String> {
    let mgr = app.state::<SyncManager>();
    Ok(SyncStatusOut {
        status: format!("{:?}", mgr.status()),
        running: mgr.is_running(),
        pending: mgr.pending_count()?,
    })
}

#[tauri::command]
pub async fn force_sync(app: tauri::AppHandle) -> Result<(), String> {
    let mgr = app.state::<SyncManager>();
    mgr.flush().map(|_| ())
}

#[tauri::command]
pub async fn flush_offline_queue(app: tauri::AppHandle) -> Result<(), String> {
    let mgr = app.state::<SyncManager>();
    mgr.flush().map(|_| ())
}

/// Queue an offline operation from the frontend. `dedupe_key` lets repeated
/// edits to the same entity coalesce to the latest payload.
#[tauri::command]
pub async fn enqueue_sync_operation(
    app: tauri::AppHandle,
    entity: String,
    operation: String,
    payload: String,
    dedupe_key: String,
) -> Result<(), String> {
    let mgr = app.state::<SyncManager>();
    mgr.enqueue(&entity, &operation, &payload, &dedupe_key)
}

/// Frontend reports which operations were successfully applied.
#[tauri::command]
pub async fn mark_synced(app: tauri::AppHandle, ids: Vec<String>) -> Result<(), String> {
    let mgr = app.state::<SyncManager>();
    mgr.mark_synced(&ids)
}

/// Frontend reports an operation that failed to apply.
#[tauri::command]
pub async fn mark_failed(app: tauri::AppHandle, id: String, error: String) -> Result<(), String> {
    let mgr = app.state::<SyncManager>();
    mgr.mark_failed(&id, &error)
}

use serde::Serialize;
