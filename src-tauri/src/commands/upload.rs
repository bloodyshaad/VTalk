use tauri::Manager;

#[tauri::command]
pub fn init_upload(
    app: tauri::AppHandle,
    file_path: String,
    bucket: String,
    user_id: Option<String>,
) -> Result<String, String> {
    let queue = app.state::<crate::desktop_service::upload_queue::UploadQueue>();
    // Uploads are scoped by the authenticated user. The frontend supplies the
    // real user id; fall back to "local" only when none is provided.
    queue.init_upload(&user_id.unwrap_or_else(|| "local".to_string()), &file_path, &bucket)
}

#[tauri::command]
pub fn cancel_upload(app: tauri::AppHandle, upload_id: String) -> Result<(), String> {
    let queue = app.state::<crate::desktop_service::upload_queue::UploadQueue>();
    queue.cancel(&upload_id)
}

#[tauri::command]
pub fn get_upload_progress(app: tauri::AppHandle, upload_id: String) -> Result<u32, String> {
    let queue = app.state::<crate::desktop_service::upload_queue::UploadQueue>();
    queue.progress(&upload_id)
}

#[tauri::command]
pub fn pause_upload(app: tauri::AppHandle, upload_id: String) -> Result<(), String> {
    let queue = app.state::<crate::desktop_service::upload_queue::UploadQueue>();
    queue.pause(&upload_id)
}

#[tauri::command]
pub fn resume_upload(app: tauri::AppHandle, upload_id: String) -> Result<(), String> {
    let queue = app.state::<crate::desktop_service::upload_queue::UploadQueue>();
    queue.resume(&upload_id)
}
