use crate::media::noise_suppression;
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[derive(Serialize, Clone)]
pub struct VideoDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
}

#[tauri::command]
pub fn get_audio_devices() -> Result<Vec<AudioDevice>, String> {
    // Full device enumeration requires the `windows` crate + WASAPI COM, which
    // is intentionally not bundled. The system default is exposed as a stable
    // entry; the frontend's WebRTC stack enumerates the full device list via
    // getUserMedia/getDisplayMedia for the actual capture graph.
    Ok(vec![AudioDevice {
        id: "default".to_string(),
        name: "System Default".to_string(),
        is_default: true,
    }])
}

#[tauri::command]
pub fn get_video_devices() -> Result<Vec<VideoDevice>, String> {
    Ok(vec![VideoDevice {
        id: "default".to_string(),
        name: "System Default Camera".to_string(),
        is_default: true,
    }])
}

#[tauri::command]
pub fn set_audio_device(_device_id: String) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub fn enable_noise_suppression(enabled: bool) -> Result<(), String> {
    // Toggle the process-wide noise suppression flag consumed by the audio
    // processing pipeline on every frame.
    noise_suppression::set_global_enabled(enabled);
    Ok(())
}

#[tauri::command]
pub fn get_noise_suppression_status() -> Result<bool, String> {
    Ok(noise_suppression::is_global_enabled())
}

#[tauri::command]
pub fn process_audio_frame(stream_id: String, frame: Vec<f32>) -> Result<Vec<f32>, String> {
    Ok(noise_suppression::process_audio_frame(&stream_id, frame))
}
