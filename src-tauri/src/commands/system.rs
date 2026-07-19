use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub arch: String,
    pub app_version: String,
}

#[tauri::command]
pub fn get_app_data_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    Ok(dir)
}

#[tauri::command]
pub fn get_cache_dir(app: tauri::AppHandle) -> Result<String, String> {
    let dir = app
        .path()
        .app_cache_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    Ok(dir)
}

/// Best-effort OS version string. On Windows we parse the output of `cmd /c
/// ver`; on other platforms we fall back to a kernel/version probe. This avoids
/// depending on the heavy `windows` crate just to read the OS version.
fn detect_os_version() -> String {
    if cfg!(target_os = "windows") {
        if let Ok(output) = std::process::Command::new("cmd")
            .args(["/c", "ver"])
            .output()
        {
            let raw = String::from_utf8_lossy(&output.stdout);
            // Typical output: "Microsoft Windows [Version 10.0.19045]"
            if let Some(start) = raw.find("[Version ") {
                let rest = &raw[start + "[Version ".len()..];
                if let Some(end) = rest.find(']') {
                    return rest[..end].trim().to_string();
                }
            }
        }
        return "Windows".to_string();
    }
    if let Ok(v) = std::fs::read_to_string("/etc/os-release") {
        for line in v.lines() {
            if let Some(ver) = line.strip_prefix("PRETTY_NAME=") {
                return ver.trim_matches('"').to_string();
            }
        }
    }
    std::env::consts::OS.to_string()
}

#[tauri::command]
pub fn get_system_info(app: tauri::AppHandle) -> Result<SystemInfo, String> {
    Ok(SystemInfo {
        os: std::env::consts::OS.to_string(),
        os_version: detect_os_version(),
        arch: std::env::consts::ARCH.to_string(),
        app_version: app.package_info().version.to_string(),
    })
}

#[tauri::command]
pub async fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}
