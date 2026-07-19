use crate::desktop_service::notification_service::NotificationSettings;
use tauri::Manager;

#[tauri::command]
pub fn show_notification(
    app: tauri::AppHandle,
    title: String,
    body: String,
    icon: Option<String>,
) -> Result<(), String> {
    let svc = app.state::<crate::desktop_service::notification_service::NotificationService>();
    svc.show(&title, &body, icon.as_deref())
}

#[tauri::command]
pub fn request_notification_permission(app: tauri::AppHandle) -> Result<(), String> {
    let svc = app.state::<crate::desktop_service::notification_service::NotificationService>();
    svc.request_permission()
}

#[tauri::command]
pub fn get_notification_settings(
    app: tauri::AppHandle,
) -> Result<NotificationSettings, String> {
    let svc = app.state::<crate::desktop_service::notification_service::NotificationService>();
    Ok(svc.settings())
}
