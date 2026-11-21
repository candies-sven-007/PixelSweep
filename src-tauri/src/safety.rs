use std::path::{Path, PathBuf};

/// Normalize path string to lowercase for cross-platform safety matching.
fn norm(p: &Path) -> String {
    let s = p.to_string_lossy().to_string();
    let trimmed = s.trim_end_matches(['/', '\\']);
    #[cfg(target_os = "windows")]
    {
        trimmed.replace('/', "\\").to_lowercase()
    }
    #[cfg(not(target_os = "windows"))]
    {
        if trimmed.is_empty() {
            "/".to_string()
        } else {
            trimmed.to_string()
        }
    }
}

/// Hard-coded kernel/OS critical path guardrail.
/// Returns Err(reason) if the path MUST NEVER be deleted under any circumstance.
pub fn verify_deletable(path: &Path) -> Result<(), String> {
    if !path.exists() && path.symlink_metadata().is_err() {
        return Err("路径不存在".to_string());
    }

    let normalized = norm(path);

    // Protect user's home directory root itself
    if let Some(home) = dirs::home_dir() {
        let home_norm = norm(&home);
        if normalized == home_norm {
            return Err("安全拦截：禁止删除当前用户主目录根路径".to_string());
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Reject drive roots like "c:" or "d:"
        if normalized.len() <= 3 && normalized.ends_with(':') {
            return Err("安全拦截：禁止删除磁盘根目录".to_string());
        }
        let protected_exact: &[&str] = &[
            "c:\\windows",
            "c:\\windows\\system32",
            "c:\\windows\\syswow64",
            "c:\\windows\\winsxs",
            "c:\\windows\\boot",
            "c:\\program files",
            "c:\\program files (x86)",
            "c:\\programdata",
            "c:\\users",
            "c:\\recovery",
            "c:\\boot",
            "c:\\efi",
        ];
        for p in protected_exact {
            if normalized == *p {
                return Err(format!("安全拦截：受保护系统核心目录 ({})", p));
            }
        }
        let protected_prefixes: &[&str] = &[
            "c:\\windows\\system32\\",
            "c:\\windows\\syswow64\\",
            "c:\\windows\\winsxs\\",
            "c:\\windows\\servicing\\",
            "c:\\recovery\\",
            "c:\\efi\\",
        ];
        for prefix in protected_prefixes {
            if normalized.starts_with(prefix) {
                return Err(format!("安全拦截：路径位于受保护核心系统区 ({})", prefix));
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        let protected_exact: &[&str] = &[
            "/",
            "/System",
            "/usr",
            "/bin",
            "/sbin",
            "/etc",
            "/var",
            "/private",
            "/Library",
            "/Applications",
            "/Users",
            "/Volumes",
            "/cores",
            "/dev",
        ];
        for p in protected_exact {
            if normalized == *p {
                return Err(format!("安全拦截：受保护 macOS 系统目录 ({})", p));
            }
        }
        let protected_prefixes: &[&str] = &[
            "/System/",
            "/usr/",
            "/bin/",
            "/sbin/",
            "/Library/Apple/",
            "/private/etc/",
        ];
        for prefix in protected_prefixes {
            if normalized.starts_with(prefix) {
                return Err(format!("安全拦截：路径位于 SIP/系统核心保护区 ({})", prefix));
            }
        }
    }

    Ok(())
}

/// Detect whether a path resides in an elevated / system-wide location
/// so the UI can raise a visible security warning before user approval.
pub fn is_elevated_path(path: &Path) -> bool {
    let normalized = norm(path);
    #[cfg(target_os = "windows")]
    {
        return normalized.starts_with("c:\\windows\\")
            || normalized.starts_with("c:\\programdata\\")
            || normalized.starts_with("c:\\program files\\")
            || normalized.starts_with("c:\\program files (x86)\\");
    }
    #[cfg(target_os = "macos")]
    {
        return normalized.starts_with("/Library/")
            || normalized.starts_with("/private/var/")
            || normalized.starts_with("/Applications/");
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = normalized;
        false
    }
}

pub fn check_is_elevated() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("fltmc")
            .creation_flags(CREATE_NO_WINDOW)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("id")
            .arg("-u")
            .output()
            .ok()
            .and_then(|o| String::from_utf8(o.stdout).ok())
            .map(|s| s.trim() == "0")
            .unwrap_or(false)
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        false
    }
}

pub fn check_full_disk_access() -> bool {
    #[cfg(target_os = "macos")]
    {
        // Probe a TCC-protected directory; readable only if Full Disk Access is granted.
        if let Some(home) = dirs::home_dir() {
            let safari_dir = home.join("Library/Safari");
            if safari_dir.exists() {
                return std::fs::read_dir(&safari_dir).is_ok();
            }
            let mail_dir = home.join("Library/Mail");
            if mail_dir.exists() {
                return std::fs::read_dir(&mail_dir).is_ok();
            }
        }
        std::fs::read_dir("/Library/Application Support/com.apple.TCC").is_ok()
    }
    #[cfg(not(target_os = "macos"))]
    {
        true
    }
}

pub fn existing_paths(candidates: Vec<PathBuf>) -> Vec<PathBuf> {
    candidates.into_iter().filter(|p| p.exists()).collect()
}
