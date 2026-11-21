use crate::models::MusicTrack;
use std::path::PathBuf;
use walkdir::WalkDir;

const AUDIO_EXTS: &[&str] = &["mp3", "flac", "wav", "m4a", "aac", "ogg", "opus"];

pub fn scan_music_directory(custom_dir: Option<String>) -> Result<(String, Vec<MusicTrack>), String> {
    let dir = match custom_dir {
        Some(d) if !d.trim().is_empty() => PathBuf::from(d),
        _ => dirs::audio_dir().ok_or_else(|| "未找到系统默认音乐文件夹，请手动选择音乐目录".to_string())?,
    };

    if !dir.exists() || !dir.is_dir() {
        return Err(format!("音乐目录不存在: {}", dir.to_string_lossy()));
    }

    let mut tracks = Vec::new();
    for entry in WalkDir::new(&dir).max_depth(4).follow_links(false).into_iter().flatten() {
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .map(|s| s.to_lowercase())
            .unwrap_or_default();

        if !AUDIO_EXTS.contains(&ext.as_str()) {
            continue;
        }

        let title = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("未知曲目")
            .to_string();
        let folder = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|s| s.to_str())
            .unwrap_or("Music")
            .to_string();
        let size_bytes = entry.metadata().map(|m| m.len()).unwrap_or(0);

        tracks.push(MusicTrack {
            path: path.to_string_lossy().to_string(),
            title,
            folder,
            ext: ext.to_uppercase(),
            size_bytes,
        });

        if tracks.len() >= 500 {
            break;
        }
    }

    tracks.sort_by(|a, b| a.title.to_lowercase().cmp(&b.title.to_lowercase()));
    Ok((dir.to_string_lossy().to_string(), tracks))
}
