use crate::media;
use std::path::Path;

/// Media processing service. Runs image thumbnail generation, image
/// optimization, and (when ffmpeg is present) video transcoding. Long-running
/// work is intended to run on a thread pool; the functions here are
/// synchronous and CPU-bound, so callers should `spawn_blocking`.
pub struct MediaProcessor;

#[derive(serde::Serialize)]
pub struct ProcessedMedia {
    pub thumbnail_path: Option<String>,
    pub optimized_path: Option<String>,
    pub transcoded_path: Option<String>,
    pub width: u32,
    pub height: u32,
}

impl MediaProcessor {
    pub fn new() -> Self {
        Self
    }

    /// Full pipeline for an uploaded image: generate thumbnail + optimized copy.
    pub fn process_image(&self, path: &str, thumb_size: u32) -> Result<ProcessedMedia, String> {
        let meta = media::thumbnail::get_metadata(path)?;
        let thumbnail = media::thumbnail::generate_thumbnail(path, thumb_size).ok();
        let optimized = media::thumbnail::optimize_image(path, 85).ok();
        Ok(ProcessedMedia {
            thumbnail_path: thumbnail,
            optimized_path: optimized,
            transcoded_path: None,
            width: meta.width,
            height: meta.height,
        })
    }

    /// Process a video: probe dimensions and (if ffmpeg available) transcode.
    pub fn process_video(&self, path: &str) -> Result<ProcessedMedia, String> {
        let meta = media::thumbnail::get_metadata(path)?;
        let transcoded = if Path::new(path).extension().map(|e| e == "mp4").unwrap_or(false) {
            None
        } else {
            media::transcoder::transcode(path, "mp4").ok()
        };
        Ok(ProcessedMedia {
            thumbnail_path: None,
            optimized_path: None,
            transcoded_path: transcoded,
            width: meta.width,
            height: meta.height,
        })
    }
}
