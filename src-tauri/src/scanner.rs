use crate::models::{
    DiskSummary, FullScanResult, ScanCategoryResult, ScanProgressPayload, ScannedItem, SystemStatus,
};
use crate::safety::{check_full_disk_access, check_is_elevated, existing_paths, is_elevated_path};
use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};
use sysinfo::Disks;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

struct CategoryBlueprint {
    id: &'static str,
    name: &'static str,
    description: &'static str,
    risk_level: &'static str,
    requires_privilege: bool,
    default_selected: bool,
    paths: Vec<PathBuf>,
    max_depth: usize,
    large_file_min_bytes: Option<u64>,
}

pub fn collect_system_status() -> SystemStatus {
    let is_elevated = check_is_elevated();
    let has_full_disk_access = check_full_disk_access();
    let disks_raw = Disks::new_with_refreshed_list();

    let mut disks = Vec::new();
    for d in disks_raw.list() {
        let total = d.total_space();
        if total == 0 {
            continue;
        }
        let avail = d.available_space();
        let mount = d.mount_point().to_string_lossy().to_string();
        #[cfg(target_os = "macos")]
        if mount.starts_with("/System/Volumes/") && mount != "/System/Volumes/Data" {
            continue;
        }
        disks.push(DiskSummary {
            name: d.name().to_string_lossy().to_string(),
            mount_point: mount,
            total_bytes: total,
            available_bytes: avail,
            used_bytes: total.saturating_sub(avail),
            file_system: d.file_system().to_string_lossy().to_string(),
        });
    }

    let mut permission_warnings = Vec::new();
    #[cfg(target_os = "windows")]
    {
        if !is_elevated {
            permission_warnings.push(
                "当前未以管理员身份运行：C:\\Windows\\Temp 与 Windows 更新缓存等系统级目录可能受限访问，如需深度清理请右键「以管理员身份运行」。".to_string()
            );
        }
    }
    #[cfg(target_os = "macos")]
    {
        if !has_full_disk_access {
            permission_warnings.push(
                "未检测到 macOS「完全磁盘访问权限」：Safari 缓存、系统日志及部分受保护目录可能无法完整扫描。可点击左侧按钮前往系统设置授权。".to_string()
            );
        }
        if !is_elevated {
            permission_warnings.push(
                "系统级 /Library/Caches 与 /Library/Logs 清理可能需要管理员授权，系统将对受保护项触发审核警报。".to_string()
            );
        }
    }

    SystemStatus {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        is_elevated,
        has_full_disk_access,
        default_music_dir: dirs::audio_dir().map(|p| p.to_string_lossy().to_string()),
        disks,
        permission_warnings,
    }
}

fn build_blueprints() -> Vec<CategoryBlueprint> {
    let mut list = Vec::new();
    let home = dirs::home_dir().unwrap_or_default();

    #[cfg(target_os = "windows")]
    {
        let local_app = dirs::data_local_dir().unwrap_or_else(|| home.join("AppData\\Local"));
        let roaming = dirs::data_dir().unwrap_or_else(|| home.join("AppData\\Roaming"));
        let temp_env = std::env::temp_dir();

        list.push(CategoryBlueprint {
            id: "win_user_temp",
            name: "用户临时文件 (%TEMP%)",
            description: "应用程序运行过程中遗留的临时安装包、解压碎片与日志文件，可安全清理。",
            risk_level: "safe",
            requires_privilege: false,
            default_selected: true,
            paths: existing_paths(vec![temp_env, local_app.join("Temp")]),
            max_depth: 2,
            large_file_min_bytes: None,
        });

        list.push(CategoryBlueprint {
            id: "win_browser_cache",
            name: "浏览器网页缓存",
            description: "Chrome、Edge、Brave、Firefox 的静态网页与图片缓存（不触碰密码、书签和登录 Cookie）。",
            risk_level: "safe",
            requires_privilege: false,
            default_selected: true,
            paths: existing_paths(vec![
                local_app.join("Google\\Chrome\\User Data\\Default\\Cache"),
                local_app.join("Google\\Chrome\\User Data\\Default\\Code Cache"),
                local_app.join("Microsoft\\Edge\\User Data\\Default\\Cache"),
                local_app.join("Microsoft\\Edge\\User Data\\Default\\Code Cache"),
                local_app.join("BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache"),
                local_app.join("Mozilla\\Firefox\\Profiles"),
            ]),
            max_depth: 2,
            large_file_min_bytes: None,
        });

        list.push(CategoryBlueprint {
            id: "win_shader_dev_cache",
            name: "显卡着色器与开发工具缓存",
            description: "DirectX/NVIDIA 着色器缓存、npm/pip/pnpm/Cargo/VSCode 冗余缓存，删除后下次启动会自动重建。",
            risk_level: "caution",
            requires_privilege: false,
            default_selected: false,
            paths: existing_paths(vec![
                local_app.join("D3DSCache"),
                local_app.join("NVIDIA\\DXCache"),
                local_app.join("NVIDIA\\GLCache"),
                local_app.join("npm-cache"),
                local_app.join("pip\\Cache"),
                roaming.join("npm-cache"),
                roaming.join("Code\\Cache"),
                roaming.join("Code\\CachedData"),
                home.join(".cargo\\registry\\cache"),
            ]),
            max_depth: 2,
            large_file_min_bytes: None,
        });

        list.push(CategoryBlueprint {
            id: "win_crash_dumps",
            name: "崩溃转储与诊断日志",
            description: "程序异常闪退生成的 .dmp 转储文件与错误报告，通常体积较大且日常无需保留。",
            risk_level: "safe",
            requires_privilege: false,
            default_selected: true,
            paths: existing_paths(vec![
                local_app.join("CrashDumps"),
                PathBuf::from("C:\\Windows\\Minidump"),
                PathBuf::from("C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive"),
            ]),
            max_depth: 2,
            large_file_min_bytes: None,
        });

        list.push(CategoryBlueprint {
            id: "win_system_temp",
            name: "C 盘系统级临时目录与更新缓存",
            description: "C:\\Windows\\Temp 与 Windows Update 已下载缓存。涉及系统权限，清理前会强制触发风险审核警报。",
            risk_level: "elevated",
            requires_privilege: true,
            default_selected: false,
            paths: existing_paths(vec![
                PathBuf::from("C:\\Windows\\Temp"),
                PathBuf::from("C:\\Windows\\SoftwareDistribution\\Download"),
            ]),
            max_depth: 2,
            large_file_min_bytes: None,
        });

        let mut large_roots = Vec::new();
        if let Some(dl) = dirs::download_dir() {
            large_roots.push(dl);
        }
        if let Some(desk) = dirs::desktop_dir() {
            large_roots.push(desk);
        }
        list.push(CategoryBlueprint {
            id: "large_files",
            name: "大文件深度雷达 (> 100 MB)",
            description: "自动定位下载目录与桌面中超过 100 MB 的旧安装包、压缩包与视频文件（默认不勾选，需人工审核）。",
            risk_level: "caution",
            requires_privilege: false,
            default_selected: false,
            paths: existing_paths(large_roots),
            max_depth: 4,
            large_file_min_bytes: Some(100 * 1024 * 1024),
        });
    }

    #[cfg(target_os = "macos")]
    {
        let lib = home.join("Library");

        list.push(CategoryBlueprint {
            id: "mac_user_caches",
            name: "用户应用缓存 (~/Library/Caches)",
            description: "macOS 各软件生成的本地缓存目录，清理后应用会按需重建，可有效释放根目录空间。",
            risk_level: "safe",
            requires_privilege: false,
            default_selected: true,
            paths: existing_paths(vec![lib.join("Caches")]),
            max_depth: 1,
            large_file_min_bytes: None,
        });

        list.push(CategoryBlueprint {
            id: "mac_user_logs",
            name: "用户日志与崩溃报告 (~/Library/Logs)",
            description: "应用程序日志与系统诊断报告文件，清理不影响任何软件数据。",
            risk_level: "safe",
            requires_privilege: false,
            default_selected: true,
            paths: existing_paths(vec![lib.join("Logs")]),
            max_depth: 2,
            large_file_min_bytes: None,
        });

        list.push(CategoryBlueprint {
            id: "mac_dev_caches",
            name: "开发者构建与包管理缓存",
            description: "Xcode DerivedData、Homebrew 下载缓存、npm/pip/Cargo/Gradle 缓存，通常可释放数 GB 空间。",
            risk_level: "caution",
            requires_privilege: false,
            default_selected: false,
            paths: existing_paths(vec![
                lib.join("Developer/Xcode/DerivedData"),
                lib.join("Caches/Homebrew"),
                lib.join("Caches/pip"),
                home.join(".npm/_cacache"),
                home.join(".cargo/registry/cache"),
                home.join(".gradle/caches"),
            ]),
            max_depth: 1,
            large_file_min_bytes: None,
        });

        list.push(CategoryBlueprint {
            id: "mac_system_caches",
            name: "系统根目录缓存与日志 (/Library)",
            description: "/Library/Caches 与 /Library/Logs 属于系统全局目录，涉及系统级权限，清理前会强制报警审核。",
            risk_level: "elevated",
            requires_privilege: true,
            default_selected: false,
            paths: existing_paths(vec![
                PathBuf::from("/Library/Caches"),
                PathBuf::from("/Library/Logs"),
            ]),
            max_depth: 1,
            large_file_min_bytes: None,
        });

        let mut large_roots = Vec::new();
        if let Some(dl) = dirs::download_dir() {
            large_roots.push(dl);
        }
        if let Some(desk) = dirs::desktop_dir() {
            large_roots.push(desk);
        }
        list.push(CategoryBlueprint {
            id: "large_files",
            name: "大文件深度雷达 (> 100 MB)",
            description: "扫描下载目录与桌面中超过 100 MB 的 .dmg 安装镜像、压缩包与大文件（默认不勾选，需人工审核）。",
            risk_level: "caution",
            requires_privilege: false,
            default_selected: false,
            paths: existing_paths(large_roots),
            max_depth: 4,
            large_file_min_bytes: Some(100 * 1024 * 1024),
        });
    }

    for bp in &mut list {
        bp.paths.sort();
        bp.paths.dedup();
    }
    list
}

fn dir_size_safe(path: &Path) -> (u64, usize) {
    let mut total = 0u64;
    let mut denied = 0usize;
    for entry in WalkDir::new(path).follow_links(false) {
        match entry {
            Ok(e) => {
                if e.file_type().is_file() {
                    if let Ok(meta) = e.metadata() {
                        total = total.saturating_add(meta.len());
                    }
                }
            }
            Err(_) => {
                denied += 1;
            }
        }
    }
    (total, denied)
}

fn modified_unix(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn run_full_scan(app: &AppHandle) -> FullScanResult {
    let started = Instant::now();
    let blueprints = build_blueprints();
    let total_cats = blueprints.len().max(1);

    let mut categories = Vec::new();
    let mut grand_bytes = 0u64;
    let mut grand_items = 0usize;
    let mut grand_denied = 0usize;

    for (idx, bp) in blueprints.into_iter().enumerate() {
        let mut items: Vec<ScannedItem> = Vec::new();
        let mut cat_bytes = 0u64;
        let mut cat_denied = 0usize;
        let root_strs: Vec<String> = bp.paths.iter().map(|p| p.to_string_lossy().to_string()).collect();

        let _ = app.emit(
            "scan-progress",
            ScanProgressPayload {
                stage: bp.name.to_string(),
                current_path: root_strs.first().cloned().unwrap_or_else(|| "准备中...".to_string()),
                found_bytes: grand_bytes,
                found_items: grand_items,
                progress_pct: ((idx * 100) / total_cats) as u8,
            },
        );

        for root in &bp.paths {
            if let Some(min_size) = bp.large_file_min_bytes {
                for entry in WalkDir::new(root).max_depth(bp.max_depth).follow_links(false) {
                    match entry {
                        Ok(e) => {
                            if e.file_type().is_file() {
                                if let Ok(meta) = e.metadata() {
                                    let sz = meta.len();
                                    if sz >= min_size {
                                        let p = e.path();
                                        cat_bytes = cat_bytes.saturating_add(sz);
                                        grand_bytes = grand_bytes.saturating_add(sz);
                                        grand_items += 1;
                                        items.push(ScannedItem {
                                            path: p.to_string_lossy().to_string(),
                                            name: e.file_name().to_string_lossy().to_string(),
                                            size_bytes: sz,
                                            is_dir: false,
                                            modified_ts: modified_unix(p),
                                            category_id: bp.id.to_string(),
                                            risk_level: bp.risk_level.to_string(),
                                            requires_privilege: bp.requires_privilege || is_elevated_path(p),
                                        });
                                    }
                                }
                            }
                        }
                        Err(_) => {
                            cat_denied += 1;
                            grand_denied += 1;
                        }
                    }
                }
            } else {
                match std::fs::read_dir(root) {
                    Ok(rd) => {
                        for entry_res in rd {
                            match entry_res {
                                Ok(entry) => {
                                    let p = entry.path();
                                    let ftype = match entry.file_type() {
                                        Ok(ft) => ft,
                                        Err(_) => {
                                            cat_denied += 1;
                                            grand_denied += 1;
                                            continue;
                                        }
                                    };
                                    if ftype.is_symlink() {
                                        continue;
                                    }
                                    let (sz, sub_denied) = if ftype.is_dir() {
                                        dir_size_safe(&p)
                                    } else {
                                        (entry.metadata().map(|m| m.len()).unwrap_or(0), 0)
                                    };
                                    cat_denied += sub_denied;
                                    grand_denied += sub_denied;

                                    if sz == 0 && !ftype.is_dir() {
                                        continue;
                                    }
                                    cat_bytes = cat_bytes.saturating_add(sz);
                                    grand_bytes = grand_bytes.saturating_add(sz);
                                    grand_items += 1;

                                    items.push(ScannedItem {
                                        path: p.to_string_lossy().to_string(),
                                        name: entry.file_name().to_string_lossy().to_string(),
                                        size_bytes: sz,
                                        is_dir: ftype.is_dir(),
                                        modified_ts: modified_unix(&p),
                                        category_id: bp.id.to_string(),
                                        risk_level: bp.risk_level.to_string(),
                                        requires_privilege: bp.requires_privilege || is_elevated_path(&p),
                                    });

                                    if grand_items % 12 == 0 {
                                        let _ = app.emit(
                                            "scan-progress",
                                            ScanProgressPayload {
                                                stage: bp.name.to_string(),
                                                current_path: p.to_string_lossy().to_string(),
                                                found_bytes: grand_bytes,
                                                found_items: grand_items,
                                                progress_pct: (((idx * 100) + 50) / total_cats).min(99) as u8,
                                            },
                                        );
                                    }
                                }
                                Err(_) => {
                                    cat_denied += 1;
                                    grand_denied += 1;
                                }
                            }
                        }
                    }
                    Err(_) => {
                        cat_denied += 1;
                        grand_denied += 1;
                    }
                }
            }
        }

        items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
        if items.len() > 250 {
            items.truncate(250);
        }

        categories.push(ScanCategoryResult {
            id: bp.id.to_string(),
            name: bp.name.to_string(),
            description: bp.description.to_string(),
            risk_level: bp.risk_level.to_string(),
            requires_privilege: bp.requires_privilege,
            default_selected: bp.default_selected,
            root_paths: root_strs,
            total_bytes: cat_bytes,
            item_count: items.len(),
            denied_count: cat_denied,
            items,
        });
    }

    let _ = app.emit(
        "scan-progress",
        ScanProgressPayload {
            stage: "全盘体检完成".to_string(),
            current_path: "准备就绪，请审视扫描清单".to_string(),
            found_bytes: grand_bytes,
            found_items: grand_items,
            progress_pct: 100,
        },
    );

    FullScanResult {
        categories,
        total_bytes: grand_bytes,
        total_items: grand_items,
        total_denied: grand_denied,
        duration_ms: started.elapsed().as_millis(),
    }
}

pub fn scan_custom_directory(app: &AppHandle, target_dir: &str, min_size_mb: u64) -> Result<ScanCategoryResult, String> {
    let root = PathBuf::from(target_dir);
    if !root.exists() || !root.is_dir() {
        return Err("所选路径不存在或不是文件夹".to_string());
    }

    let min_bytes = min_size_mb.saturating_mul(1024 * 1024);
    let mut items = Vec::new();
    let mut total_bytes = 0u64;
    let mut denied_count = 0usize;
    let elevated = is_elevated_path(&root);

    let _ = app.emit(
        "scan-progress",
        ScanProgressPayload {
            stage: "自定义目录深度扫描".to_string(),
            current_path: target_dir.to_string(),
            found_bytes: 0,
            found_items: 0,
            progress_pct: 20,
        },
    );

    for entry in WalkDir::new(&root).max_depth(5).follow_links(false) {
        match entry {
            Ok(e) => {
                if e.file_type().is_file() {
                    if let Ok(meta) = e.metadata() {
                        let sz = meta.len();
                        if sz >= min_bytes {
                            let p = e.path();
                            total_bytes = total_bytes.saturating_add(sz);
                            items.push(ScannedItem {
                                path: p.to_string_lossy().to_string(),
                                name: e.file_name().to_string_lossy().to_string(),
                                size_bytes: sz,
                                is_dir: false,
                                modified_ts: modified_unix(p),
                                category_id: "custom_scan".to_string(),
                                risk_level: if elevated { "elevated".to_string() } else { "caution".to_string() },
                                requires_privilege: elevated || is_elevated_path(p),
                            });
                            if items.len() % 15 == 0 {
                                let _ = app.emit(
                                    "scan-progress",
                                    ScanProgressPayload {
                                        stage: "自定义目录深度扫描".to_string(),
                                        current_path: p.to_string_lossy().to_string(),
                                        found_bytes: total_bytes,
                                        found_items: items.len(),
                                        progress_pct: 65,
                                    },
                                );
                            }
                        }
                    }
                }
            }
            Err(_) => {
                denied_count += 1;
            }
        }
    }

    items.sort_by(|a, b| b.size_bytes.cmp(&a.size_bytes));
    if items.len() > 300 {
        items.truncate(300);
    }

    let _ = app.emit(
        "scan-progress",
        ScanProgressPayload {
            stage: "自定义目录扫描完成".to_string(),
            current_path: target_dir.to_string(),
            found_bytes: total_bytes,
            found_items: items.len(),
            progress_pct: 100,
        },
    );

    Ok(ScanCategoryResult {
        id: "custom_scan".to_string(),
        name: format!("自定义深度扫描 ({})", target_dir),
        description: format!("筛选大于 {} MB 的文件，默认不勾选，请逐项审核后再决定是否清理。", min_size_mb),
        risk_level: if elevated { "elevated".to_string() } else { "caution".to_string() },
        requires_privilege: elevated,
        default_selected: false,
        root_paths: vec![target_dir.to_string()],
        total_bytes,
        item_count: items.len(),
        denied_count,
        items,
    })
}
