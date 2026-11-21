use crate::safety::is_elevated_path;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub struct Classification {
    pub domain: &'static str,         // junk | dev_cache | entertainment | life | work | system_elevated
    pub recommendation: &'static str, // recommend | review | protect
    pub risk_level: &'static str,     // safe | caution | protected | elevated
    pub ai_reason: String,
    pub requires_privilege: bool,
}

pub fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn age_days(modified_ts: u64) -> u64 {
    let now = now_unix();
    if modified_ts == 0 || modified_ts > now {
        return 0;
    }
    (now - modified_ts) / 86400
}

fn contains_any(haystack: &str, needles: &[&str]) -> bool {
    needles.iter().any(|n| haystack.contains(n))
}

/// Skip core OS / system protected directories during broad drive traversal
/// so full-drive smart analysis stays fast and never touches kernel binaries.
pub fn should_skip_during_broad_scan(path: &Path) -> bool {
    let s = path.to_string_lossy().to_lowercase();
    let norm = s.replace('\\', "/");

    let skip_segments = [
        "/$recycle.bin",
        "/system volume information",
        "/windows/system32",
        "/windows/syswow64",
        "/windows/winsxs",
        "/windows/servicing",
        "/windows/installer",
        "/program files/windowsapps",
        "/programdata/microsoft/windows defender",
        "/recovery",
        "/config.msi",
        "/perflogs",
        "/.git/objects",
        "/system/volumes",
        "/system/library",
        "/private/var/vm",
        "/usr/",
        "/bin/",
        "/sbin/",
        "/dev/",
        "/cores/",
    ];
    if skip_segments.iter().any(|seg| norm.contains(seg)) {
        return true;
    }

    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
        let lower = name.to_lowercase();
        if matches!(
            lower.as_str(),
            "$recycle.bin"
                | "system volume information"
                | "windows"
                | "program files"
                | "program files (x86)"
                | "programdata"
                | "recovery"
                | "msocache"
                | ".spotlight-v100"
                | ".fseventsd"
                | ".trashes"
                | ".git"
        ) {
            return true;
        }
    }

    false
}

/// Check if a directory should be collapsed as a single cleanable/auditable unit
/// rather than recursing into tens of thousands of tiny files.
pub fn is_collapsible_dir_name(name_lower: &str) -> bool {
    matches!(
        name_lower,
        "node_modules"
            | "__pycache__"
            | ".pytest_cache"
            | ".mypy_cache"
            | ".gradle"
            | "deriveddata"
            | ".next"
            | ".nuxt"
            | "dist"
            | "build"
            | "target"
            | "cache"
            | "caches"
            | "code cache"
            | "gpucache"
            | "d3dscache"
            | "dxcache"
            | "glcache"
            | "crashdumps"
    )
}

/// Local intelligent heuristic classifier:
/// Analyzes path semantics, app fingerprints, file extension, age, size, and naming patterns.
pub fn classify_entry(
    path: &Path,
    is_dir: bool,
    size_bytes: u64,
    modified_ts: u64,
    forced_domain: Option<&'static str>,
) -> Classification {
    let raw_lower = path.to_string_lossy().to_lowercase();
    let norm = raw_lower.replace('\\', "/");
    let name_lower = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .map(|s| s.to_lowercase())
        .unwrap_or_default();
    let days = age_days(modified_ts);
    let elevated = is_elevated_path(path);

    // 0. System elevated paths always trigger elevated warning
    if elevated || forced_domain == Some("system_elevated") {
        let reason = if norm.contains("softwaredistribution") {
            "Windows 更新下载缓存（清理前需管理员权限审核）".to_string()
        } else if norm.contains("/library/caches") || norm.contains("/library/logs") {
            "macOS 系统全局缓存/日志（涉及系统权限，清理前报警）".to_string()
        } else if norm.contains("windows/temp") || norm.contains("minidump") {
            "C 盘系统级临时目录或故障转储（清理前需权限审核）".to_string()
        } else {
            "位于受保护系统权限区，建议审视路径后再放行".to_string()
        };
        return Classification {
            domain: "system_elevated",
            recommendation: "review",
            risk_level: "elevated",
            ai_reason: reason,
            requires_privilege: true,
        };
    }

    // 1. Forced junk / dev_cache from dedicated cache scans
    if forced_domain == Some("junk") {
        let reason = if norm.contains("chrome") || norm.contains("edge") || norm.contains("firefox") || norm.contains("brave") {
            "浏览器静态网页缓存（不触碰密码、书签与登录态）".to_string()
        } else if norm.contains("crash") || ext == "dmp" {
            "程序闪退崩溃转储/诊断报告（可安全回收）".to_string()
        } else if norm.contains("logs") || ext == "log" {
            "应用程序运行日志（清理不影响软件使用）".to_string()
        } else {
            "系统或应用遗留临时碎片文件（可安全释放）".to_string()
        };
        return Classification {
            domain: "junk",
            recommendation: "recommend",
            risk_level: "safe",
            ai_reason: reason,
            requires_privilege: false,
        };
    }

    if forced_domain == Some("dev_cache") {
        let reason = if contains_any(&norm, &["d3dscache", "dxcache", "glcache", "nvidia"]) {
            "显卡着色器编译缓存（清理后下次进游戏自动重建）".to_string()
        } else if contains_any(&norm, &["wechat", "tencent", "qq"]) {
            "社交软件图片/临时缓存区（绝不触碰聊天记录库）".to_string()
        } else {
            "开发工具包管理/构建缓存（删除后按需自动拉取重建）".to_string()
        };
        return Classification {
            domain: "dev_cache",
            recommendation: "review",
            risk_level: "caution",
            ai_reason: reason,
            requires_privilege: false,
        };
    }

    // 2. Directory-level smart rules (stale node_modules / target / cache folders)
    if is_dir {
        if matches!(name_lower.as_str(), "node_modules" | "target" | ".gradle" | "deriveddata" | "__pycache__" | ".next") {
            if days >= 30 {
                return Classification {
                    domain: "dev_cache",
                    recommendation: "recommend",
                    risk_level: "caution",
                    ai_reason: format!("沉睡 {} 天的过期工程依赖/构建产物（可随时重装恢复）", days),
                    requires_privilege: false,
                };
            }
            return Classification {
                domain: "dev_cache",
                recommendation: "review",
                risk_level: "caution",
                ai_reason: "近期活跃工程依赖缓存（若项目仍在开发建议暂留）".to_string(),
                requires_privilege: false,
            };
        }
        if contains_any(&name_lower, &["cache", "temp", "tmp", "logs", "crash"]) {
            return Classification {
                domain: "junk",
                recommendation: "recommend",
                risk_level: "safe",
                ai_reason: "软件缓存或临时日志目录（可安全释放空间）".to_string(),
                requires_privilege: false,
            };
        }
    }

    // 3. Junk & Obsolete Waste detection (Temp files, duplicate copies, stale installers)
    if matches!(
        ext.as_str(),
        "tmp" | "temp" | "bak" | "old" | "chk" | "dmp" | "log" | "crdownload" | "part" | "download"
    ) || matches!(name_lower.as_str(), "thumbs.db" | ".ds_store" | "desktop.ini")
    {
        return Classification {
            domain: "junk",
            recommendation: "recommend",
            risk_level: "safe",
            ai_reason: if matches!(ext.as_str(), "crdownload" | "part" | "download") {
                "未完成下载的残缺临时文件（建议清理）".to_string()
            } else {
                "临时垃圾、备份碎片或冗余日志文件（安全可删）".to_string()
            },
            requires_privilege: false,
        };
    }

    // Obsolete installers in Downloads / Desktop / Data drives
    if matches!(ext.as_str(), "exe" | "msi" | "dmg" | "pkg" | "msix" | "cab" | "apk" | "ipa") {
        let in_dl_or_desk = contains_any(&norm, &["/downloads/", "/desktop/", "/下载/", "/桌面/"]);
        if in_dl_or_desk || contains_any(&name_lower, &["setup", "install", "installer", "update", "pack"]) {
            let reason = if days >= 7 {
                format!("已静置 {} 天的残留安装包（大概率已安装完毕，建议清理）", days)
            } else {
                "下载目录中的软件安装包（安装完成后即可释放）".to_string()
            };
            return Classification {
                domain: "junk",
                recommendation: if days >= 3 || in_dl_or_desk { "recommend" } else { "review" },
                risk_level: "safe",
                ai_reason: reason,
                requires_privilege: false,
            };
        }
    }

    // Duplicate copy files like "report (1).pdf", "photo - 副本.jpg"
    let looks_duplicate = name_lower.contains("(1).")
        || name_lower.contains("(2).")
        || name_lower.contains("(3).")
        || name_lower.contains(" - 副本")
        || name_lower.contains(" - copy")
        || name_lower.contains("_copy.");
    if looks_duplicate && size_bytes >= 512 * 1024 {
        return Classification {
            domain: "junk",
            recommendation: "review",
            risk_level: "caution",
            ai_reason: "疑似重复下载或多次复制产生的副本文件（建议核对后清理）".to_string(),
            requires_privilege: false,
        };
    }

    // Old large archives in Downloads (often unpacked and forgotten)
    if matches!(ext.as_str(), "zip" | "rar" | "7z" | "tar" | "gz" | "xz" | "iso") {
        if contains_any(&norm, &["/downloads/", "/下载/"]) && (days >= 14 || size_bytes >= 100 * 1024 * 1024) {
            return Classification {
                domain: "junk",
                recommendation: "review",
                risk_level: "caution",
                ai_reason: format!(
                    "下载目录沉睡压缩包/镜像（已存放 {} 天，若已解压可清理）",
                    days
                ),
                requires_privilege: false,
            };
        }
    }

    // 4. Entertainment (Games, Movies/Anime, Music, Ebooks/Comics)
    let is_game_path = contains_any(
        &norm,
        &[
            "steam", "epic games", "genshin", "原神", "mihoyo", "hoyoverse", "overwatch",
            "riot games", "battle.net", "ubisoft", "ea games", "/games/", "/游戏/", "minecraft",
        ],
    );
    if is_game_path || matches!(ext.as_str(), "pak" | "vpk" | "unity3d" | "rom" | "nsp" | "xci" | "wad") {
        return Classification {
            domain: "entertainment",
            recommendation: "review",
            risk_level: "caution",
            ai_reason: "游戏客户端、资源包或游戏存档（不玩时可释放大量空间）".to_string(),
            requires_privilege: false,
        };
    }

    if matches!(
        ext.as_str(),
        "mp4" | "mkv" | "avi" | "mov" | "flv" | "wmv" | "webm" | "rmvb" | "ts" | "m4v"
    ) {
        // Distinguish personal phone/camera videos vs entertainment/movies/screen recordings
        if contains_any(&norm, &["/dcim/", "/camera/", "/pictures/", "/相册/", "/照片/", "wechat"]) {
            return Classification {
                domain: "life",
                recommendation: "protect",
                risk_level: "protected",
                ai_reason: "相册或聊天记录中的个人生活录像（已开启防误删保护）".to_string(),
                requires_privilege: false,
            };
        }
        let reason = if size_bytes >= 300 * 1024 * 1024 {
            "超大体积影音/番剧/录屏文件（观影完毕后可按需释放）".to_string()
        } else {
            "娱乐视频、番剧或媒体素材（默认不勾选，按需清理）".to_string()
        };
        return Classification {
            domain: "entertainment",
            recommendation: "review",
            risk_level: "caution",
            ai_reason: reason,
            requires_privilege: false,
        };
    }

    if matches!(ext.as_str(), "mp3" | "flac" | "wav" | "m4a" | "aac" | "ogg" | "opus" | "ape") {
        return Classification {
            domain: "entertainment",
            recommendation: "protect",
            risk_level: "caution",
            ai_reason: "本地音乐/音频收藏（PixelSweep 底部播放器可直接播放）".to_string(),
            requires_privilege: false,
        };
    }

    if matches!(ext.as_str(), "epub" | "mobi" | "azw3" | "cbz" | "cbr") {
        return Classification {
            domain: "entertainment",
            recommendation: "protect",
            risk_level: "caution",
            ai_reason: "电子书或漫画收藏（建议按阅读情况自行整理）".to_string(),
            requires_privilege: false,
        };
    }

    // 5. Life, Photos & Personal Memories (Protected by default)
    if matches!(
        ext.as_str(),
        "jpg" | "jpeg" | "png" | "heic" | "webp" | "gif" | "bmp" | "raw" | "cr2" | "arw" | "dng" | "nef"
    ) || contains_any(
        &norm,
        &["/pictures/", "/dcim/", "/camera/", "/相册/", "/照片/", "wechat files", "tencent files"],
    ) {
        return Classification {
            domain: "life",
            recommendation: "protect",
            risk_level: "protected",
            ai_reason: if contains_any(&norm, &["wechat", "tencent", "qq"]) {
                "微信/QQ 接收的个人生活图片或文件（默认保护防误删）".to_string()
            } else {
                "个人照片、截图或生活影像资产（高价值记忆，默认保护）".to_string()
            },
            requires_privilege: false,
        };
    }

    // 6. Work, Study & Creative Projects (Protected by default)
    if matches!(
        ext.as_str(),
        "pdf" | "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "md" | "txt" | "csv" | "rtf"
            | "xmind" | "key" | "pages" | "numbers" | "psd" | "ai" | "fig" | "sketch" | "prproj"
            | "aep" | "blend" | "dwg" | "c4d" | "py" | "rs" | "ts" | "tsx" | "js" | "java" | "cpp"
            | "sql" | "db" | "sqlite"
    ) || contains_any(&norm, &["/documents/", "/文档/", "/工作/", "/学习/", "/作业/", "/课件/", "/project", "/code/"])
    {
        return Classification {
            domain: "work",
            recommendation: "protect",
            risk_level: "protected",
            ai_reason: if matches!(ext.as_str(), "psd" | "ai" | "prproj" | "aep" | "blend" | "c4d") {
                "设计/剪辑工程源文件（重要创作资产，默认保护）".to_string()
            } else {
                "工作文档、学习资料或代码工程文件（默认保护防误删）".to_string()
            },
            requires_privilege: false,
        };
    }

    // Fallback for miscellaneous archives / unrecognized large blobs
    if matches!(ext.as_str(), "zip" | "rar" | "7z" | "tar" | "gz" | "iso") {
        return Classification {
            domain: "work",
            recommendation: "review",
            risk_level: "caution",
            ai_reason: "压缩归档文件（请确认用途后再决定是否清理）".to_string(),
            requires_privilege: false,
        };
    }

    Classification {
        domain: "junk",
        recommendation: "review",
        risk_level: "caution",
        ai_reason: "未归类大体积文件（建议点击右侧「定位」查看后再处理）".to_string(),
        requires_privilege: false,
    }
}
