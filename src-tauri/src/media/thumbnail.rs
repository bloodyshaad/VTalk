#![allow(dead_code)]

use image::{image_dimensions, GenericImageView, ImageFormat};
use std::path::Path;

#[derive(serde::Serialize)]
pub struct MediaMetadata {
    pub width: u32,
    pub height: u32,
    pub media_type: String,
    pub size_bytes: u64,
    pub duration_ms: Option<u64>,
}

/// Extract metadata for an image or video file.
pub fn get_metadata(path: &str) -> Result<MediaMetadata, String> {
    let p = Path::new(path);
    let size = std::fs::metadata(p)
        .map_err(|e| format!("cannot read file: {e}"))?
        .len();
    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let (media_type, width, height) = if matches!(ext.as_str(), "mp4" | "webm" | "mov" | "mkv") {
        // For video we report dimensions via ffprobe if available, else 0.
        match crate::media::transcoder::probe_dimensions(path) {
            Ok((w, h)) => ("video".to_string(), w, h),
            Err(_) => ("video".to_string(), 0, 0),
        }
    } else {
        let (w, h) = image_dimensions(p).map_err(|e| format!("cannot read image: {e}"))?;
        let mime = match ext.as_str() {
            "png" => "image/png",
            "webp" => "image/webp",
            "gif" => "image/gif",
            _ => "image/jpeg",
        };
        (mime.to_string(), w, h)
    };

    Ok(MediaMetadata {
        width,
        height,
        media_type,
        size_bytes: size,
        duration_ms: None,
    })
}

/// Generate a square-ish thumbnail of `size`px (longest edge) and return the
/// path to the generated JPEG. Preserves aspect ratio, fits within `size`.
pub fn generate_thumbnail(path: &str, size: u32) -> Result<String, String> {
    let img = image::open(path).map_err(|e| format!("open failed: {e}"))?;
    let (w, h) = img.dimensions();
    let scale = (size as f32 / w.max(h) as f32).min(1.0);
    let nw = (w as f32 * scale).max(1.0) as u32;
    let nh = (h as f32 * scale).max(1.0) as u32;
    let thumb = img.resize(nw, nh, image::imageops::FilterType::Lanczos3);

    let out_path = output_path(path, "thumb")?;
    let mut buf = Vec::new();
    thumb
        .write_to(&mut std::io::Cursor::new(&mut buf), ImageFormat::Jpeg)
        .map_err(|e| format!("encode failed: {e}"))?;
    std::fs::write(&out_path, &buf).map_err(|e| e.to_string())?;
    Ok(out_path)
}

/// Optimize an image: resize longest edge to max 2048px, re-encode JPEG at the
/// requested quality (1-100).
pub fn optimize_image(path: &str, quality: u8) -> Result<String, String> {
    let img = image::open(path).map_err(|e| format!("open failed: {e}"))?;
    let (w, h) = img.dimensions();
    let max_edge = 2048u32;
    let scale = (max_edge as f32 / w.max(h) as f32).min(1.0);
    let nw = (w as f32 * scale).max(1.0) as u32;
    let nh = (h as f32 * scale).max(1.0) as u32;
    let resized = img.resize(nw, nh, image::imageops::FilterType::Lanczos3);

    let out_path = output_path(path, "opt")?;
    let mut buf = Vec::new();
    {
        let mut cursor = std::io::Cursor::new(&mut buf);
        let mut encoder =
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut cursor, quality.clamp(1, 100));
        encoder
            .encode(
                resized.as_bytes(),
                resized.width(),
                resized.height(),
                resized.color().into(),
            )
            .map_err(|e| format!("encode failed: {e}"))?;
    }
    std::fs::write(&out_path, &buf).map_err(|e| e.to_string())?;
    Ok(out_path)
}

fn output_path(source: &str, suffix: &str) -> Result<String, String> {
    let p = Path::new(source);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("media");
    let parent = p.parent().unwrap_or_else(|| Path::new("."));
    let name = format!("{}_{}.jpg", stem, suffix);
    Ok(parent.join(name).to_string_lossy().to_string())
}
