#![deny(unsafe_code)]

mod commands;
mod config;
mod crypto;
mod db;
mod desktop_service;
mod media;

use desktop_service::{
    cache_manager::CacheManager, media_processor::MediaProcessor,
    notification_service::NotificationService, offline_store::OfflineStore,
    sync_manager::SyncManager, upload_queue::UploadQueue,
};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Logging is enabled in BOTH debug and release builds so that a
            // release standalone still surfaces errors. Logs go to the terminal
            // (stdout), a rotating log file, and the webview devtools; webview
            // console.* output is also captured into the same stream.
            app.handle().plugin(
                tauri_plugin_log::Builder::new()
                    .level(log::LevelFilter::Info)
                    .targets([
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                            file_name: None,
                        }),
                        tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    ])
                    .build(),
            )?;

            // Initialize desktop services and register them as managed state.
            let app_data = app
                .path()
                .app_data_dir()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();
            let cache_dir = app
                .path()
                .app_cache_dir()
                .map_err(|e| e.to_string())?
                .to_string_lossy()
                .to_string();

            let offline_store = OfflineStore::open(&app_data).map_err(|e| e.to_string())?;
            let upload_queue = UploadQueue::new(offline_store.clone());
            let sync_manager = SyncManager::new(offline_store.clone());
            sync_manager.set_app(app.handle().clone());
            let cache_manager =
                CacheManager::new(&cache_dir, 1024 * 1024 * 1024).map_err(|e| e.to_string())?;
            let _media_processor = MediaProcessor::new();
            let notification_service = NotificationService::new(app.handle().clone());

            app.manage(offline_store);
            app.manage(upload_queue);
            app.manage(sync_manager);
            app.manage(cache_manager);
            app.manage(notification_service);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::get_app_data_dir,
            commands::system::get_cache_dir,
            commands::system::get_system_info,
            commands::system::open_external_url,
            commands::auth::store_session,
            commands::auth::get_session,
            commands::auth::clear_session,
            commands::auth::has_session,
            commands::crypto::generate_key_pair,
            commands::crypto::store_private_key,
            commands::crypto::get_private_key,
            commands::crypto::delete_private_key,
            commands::crypto::store_public_key,
            commands::crypto::get_public_key,
            commands::crypto::encrypt_message,
            commands::crypto::decrypt_message,
            commands::crypto::ratchet_init,
            commands::crypto::ratchet_encrypt,
            commands::crypto::ratchet_decrypt,
            commands::crypto::ratchet_safety_number,
            commands::media::get_media_metadata,
            commands::media::generate_thumbnail,
            commands::media::optimize_image,
            commands::media::transcode_video,
            commands::notifications::show_notification,
            commands::notifications::request_notification_permission,
            commands::notifications::get_notification_settings,
            commands::upload::init_upload,
            commands::upload::cancel_upload,
            commands::upload::get_upload_progress,
            commands::upload::pause_upload,
            commands::upload::resume_upload,
            commands::sync::start_background_sync,
            commands::sync::stop_background_sync,
            commands::sync::get_sync_status,
            commands::sync::force_sync,
            commands::sync::flush_offline_queue,
            commands::sync::enqueue_sync_operation,
            commands::sync::mark_synced,
            commands::sync::mark_failed,
            commands::calls::get_audio_devices,
            commands::calls::get_video_devices,
            commands::calls::set_audio_device,
            commands::calls::enable_noise_suppression,
            commands::calls::get_noise_suppression_status,
            commands::calls::process_audio_frame,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
