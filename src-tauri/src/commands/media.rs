use crate::media;

#[derive(serde::Serialize)]
pub struct MediaMetadataOut {
    pub width: u32,
    pub height: u32,
    pub media_type: String,
    pub size_bytes: u64,
    pub duration_ms: Option<u64>,
}

#[tauri::command]
pub fn get_media_metadata(path: String) -> Result<MediaMetadataOut, String> {
    let m = media::thumbnail::get_metadata(&path)?;
    Ok(MediaMetadataOut {
        width: m.width,
        height: m.height,
        media_type: m.media_type,
        size_bytes: m.size_bytes,
        duration_ms: m.duration_ms,
    })
}

#[tauri::command]
pub fn generate_thumbnail(path: String, size: u32) -> Result<String, String> {
    media::thumbnail::generate_thumbnail(&path, size)
}

#[tauri::command]
pub fn optimize_image(path: String, quality: u8) -> Result<String, String> {
    media::thumbnail::optimize_image(&path, quality)
}

#[tauri::command]
pub fn transcode_video(path: String, target_format: String) -> Result<String, String> {
    media::transcoder::transcode(&path, &target_format)
}
