use crate::models::{CleanProgressPayload, CleanReport, SkippedEntry};
use crate::safety::verify_deletable;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

fn measure_entry(path: &PathBuf) -> u64 {
    if let Ok(meta) = std::fs::symlink_metadata(path) {
        if meta.is_file() || meta.file_type().is_symlink() {
            return meta.len();
        }
    }
    let mut sum = 0u64;
    for e in WalkDir::new(path).follow_links(false).into_iter().flatten() {
        if e.file_type().is_file() {
            if let Ok(m) = e.metadata() {
                sum = sum.saturating_add(m.len());
            }
        }
    }
    sum
}

pub fn execute_clean(app: &AppHandle, paths: Vec<String>, mode: &str) -> CleanReport {
    let total = paths.len();
    let mut deleted_count = 0usize;
    let mut freed_bytes = 0u64;
    let mut skipped_items = Vec::new();

    for (idx, raw_path) in paths.into_iter().enumerate() {
        let p = PathBuf::from(&raw_path);

        let _ = app.emit(
            "clean-progress",
            CleanProgressPayload {
                current_path: raw_path.clone(),
                processed: idx + 1,
                total,
                freed_bytes,
            },
        );

        // Final hard-coded OS protection barrier
        if let Err(guard_err) = verify_deletable(&p) {
            skipped_items.push(SkippedEntry {
                path: raw_path,
                reason: guard_err,
            });
            continue;
        }

        let estimated_size = measure_entry(&p);

        let outcome: Result<(), String> = if mode == "permanent" {
            match std::fs::symlink_metadata(&p) {
                Ok(meta) => {
                    if meta.is_dir() && !meta.file_type().is_symlink() {
                        std::fs::remove_dir_all(&p).map_err(|e| format!("永久删除失败: {}", e))
                    } else {
                        std::fs::remove_file(&p).map_err(|e| format!("永久删除失败: {}", e))
                    }
                }
                Err(e) => Err(format!("无法读取路径元数据: {}", e)),
            }
        } else {
            trash::delete(&p).map_err(|e| format!("移入回收站失败（可能被占用或无权限）: {}", e))
        };

        match outcome {
            Ok(_) => {
                deleted_count += 1;
                freed_bytes = freed_bytes.saturating_add(estimated_size);
            }
            Err(reason) => {
                skipped_items.push(SkippedEntry {
                    path: raw_path,
                    reason,
                });
            }
        }
    }

    CleanReport {
        mode: mode.to_string(),
        deleted_count,
        skipped_count: skipped_items.len(),
        freed_bytes,
        skipped_items,
    }
}

pub fn empty_system_trash() -> Result<String, String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        let out = std::process::Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args([
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                "Clear-RecycleBin -Force -ErrorAction SilentlyContinue",
            ])
            .output()
            .map_err(|e| format!("调用 PowerShell 清空回收站失败: {}", e))?;
        if out.status.success() {
            Ok("已成功清空 Windows 系统回收站".to_string())
        } else {
            Err("清空回收站时部分受保护项目被跳过".to_string())
        }
    }

    #[cfg(target_os = "macos")]
    {
        let home = dirs::home_dir().ok_or_else(|| "无法定位用户目录".to_string())?;
        let trash_dir = home.join(".Trash");
        if !trash_dir.exists() {
            return Ok("废纸篓已经是空的".to_string());
        }
        let mut removed = 0usize;
        let mut skipped = 0usize;
        for entry in std::fs::read_dir(&trash_dir).map_err(|e| format!("无法读取废纸篓（请检查完全磁盘访问权限）: {}", e))? {
            if let Ok(ent) = entry {
                let p = ent.path();
                let res = if p.is_dir() {
                    std::fs::remove_dir_all(&p)
                } else {
                    std::fs::remove_file(&p)
                };
                if res.is_ok() {
                    removed += 1;
                } else {
                    skipped += 1;
                }
            }
        }
        if skipped > 0 {
            Ok(format!("已清空 {} 项，另有 {} 项被系统锁定或需完全磁盘访问权限", removed, skipped))
        } else {
            Ok(format!("已彻底清空 macOS 废纸篓（共 {} 项）", removed))
        }
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Err("当前系统暂不支持直接清空回收站".to_string())
    }
}
