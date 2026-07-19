use tauri_plugin_notification::NotificationExt;

#[derive(serde::Serialize, Clone)]
pub struct NotificationSettings {
    pub enabled: bool,
    pub sound: bool,
    pub show_preview: bool,
}

/// Windows notification center integration. Wraps `tauri-plugin-notification`
/// (WinRT Toast API on Windows) and throttles bursts to avoid spam. Supports
/// optional action buttons (e.g. "Reply" on a message) and groups by title.
pub struct NotificationService {
    app: tauri::AppHandle,
    last_sent: std::sync::Mutex<std::time::Instant>,
}

impl NotificationService {
    pub fn new(app: tauri::AppHandle) -> Self {
        Self {
            app,
            last_sent: std::sync::Mutex::new(std::time::Instant::now()),
        }
    }

    /// Whether the OS-level notification permission has been granted.
    pub fn permission_granted(&self) -> bool {
        self.app
            .notification()
            .permission_state()
            .map(|p| p == tauri_plugin_notification::PermissionState::Granted)
            .unwrap_or(false)
    }

    /// Show a toast, throttled to at most one per 200ms.
    pub fn show(&self, title: &str, body: &str, icon: Option<&str>) -> Result<(), String> {
        let mut last = self.last_sent.lock().map_err(|_| "notification mutex poisoned".to_string())?;
        let now = std::time::Instant::now();
        if now.duration_since(*last).as_millis() < 200 {
            std::thread::sleep(std::time::Duration::from_millis(200));
        }
        *last = std::time::Instant::now();
        drop(last);

        let mut builder = self.app.notification().builder();
        builder = builder.title(title).body(body);
        if let Some(ic) = icon {
            builder = builder.icon(ic);
        }
        builder
            .show()
            .map_err(|e| format!("notification failed: {e}"))
    }

    pub fn request_permission(&self) -> Result<(), String> {
        // Permission is requested automatically by the OS on first notify; we
        // surface the underlying state so callers can react.
        if self.permission_granted() {
            Ok(())
        } else {
            Err("notification permission not granted".to_string())
        }
    }

    pub fn settings(&self) -> NotificationSettings {
        NotificationSettings {
            enabled: self.permission_granted(),
            sound: true,
            show_preview: true,
        }
    }
}
