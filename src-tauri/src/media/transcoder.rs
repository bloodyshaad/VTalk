#![allow(dead_code)]

use std::process::Command;

/// Locate ffmpeg on PATH. Returns None if not installed.
fn ffmpeg_binary() -> Option<String> {
    if let Ok(out) = Command::new("ffmpeg").arg("-version").output() {
        if out.status.success() {
            return Some("ffmpeg".to_string());
        }
    }
    // Windows common install location
    let candidates = [
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
    ];
    for c in candidates {
        if std::path::Path::new(c).exists() {
            return Some(c.to_string());
        }
    }
    None
}

fn ffprobe_binary() -> Option<String> {
    if let Ok(out) = Command::new("ffprobe").arg("-version").output() {
        if out.status.success() {
            return Some("ffprobe".to_string());
        }
    }
    let candidates = [
        "C:\\ffmpeg\\bin\\ffprobe.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffprobe.exe",
    ];
    for c in candidates {
        if std::path::Path::new(c).exists() {
            return Some(c.to_string());
        }
    }
    None
}

/// Probe video dimensions via ffprobe. Returns (width, height).
pub fn probe_dimensions(path: &str) -> Result<(u32, u32), String> {
    let bin = ffprobe_binary().ok_or("ffprobe not installed")?;
    let output = Command::new(&bin)
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
            path,
        ])
        .output()
        .map_err(|e| e.to_string())?;
    if !output.status.success() {
        return Err("ffprobe failed".to_string());
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let parts: Vec<&str> = text.trim().split(',').collect();
    if parts.len() == 2 {
        let w = parts[0].trim().parse().unwrap_or(0);
        let h = parts[1].trim().parse().unwrap_or(0);
        Ok((w, h))
    } else {
        Err("unexpected ffprobe output".to_string())
    }
}

/// Transcode a video to H.264 + AAC in an MP4 container.
/// `target_format` is currently expected to be "mp4".
pub fn transcode(path: &str, target_format: &str) -> Result<String, String> {
    let bin = ffmpeg_binary().ok_or(
        "ffmpeg not installed; cannot transcode. Install ffmpeg and ensure it is on PATH.",
    )?;
    if target_format != "mp4" {
        return Err(format!("unsupported target format: {target_format}"));
    }
    let out = output_path(path)?;
    let status = Command::new(&bin)
        .args([
            "-y",
            "-i",
            path,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "23",
            "-c:a",
            "aac",
            "-b:a",
            "128k",
            "-movflags",
            "+faststart",
            &out,
        ])
        .status()
        .map_err(|e| e.to_string())?;
    if status.success() {
        Ok(out)
    } else {
        Err("ffmpeg transcode failed".to_string())
    }
}

fn output_path(source: &str) -> Result<String, String> {
    let p = std::path::Path::new(source);
    let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("video");
    let parent = p.parent().unwrap_or_else(|| std::path::Path::new("."));
    Ok(parent
        .join(format!("{}_transcoded.mp4", stem))
        .to_string_lossy()
        .to_string())
}
