use crate::analyzer::{classify_entry, is_collapsible_dir_name, should_skip_during_broad_scan};
use crate::models::{
    DiskSummary, FullScanResult, ScanCategoryResult, ScanProgressPayload, ScannedItem,
    SmartSummary, SystemStatus,
};
use crate::safety::{check_full_disk_access, check_is_elevated, existing_paths};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{Instant, UNIX_EPOCH};
use sysinfo::Disks;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

pub fn collect_system_status(is_floating_chrome: bool) -> SystemStatus {
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
                "当前为标准用户模式：C:\\Windows\\Temp 与更新缓存等系统级目录受限访问，如需深度系统清理请右键图标选择「以管理员身份运行」。".to_string()
            );
        }
    }
    #[cfg(target_os = "macos")]
    {
        if !has_full_disk_access {
            permission_warnings.push(
                "未检测到 macOS「完全磁盘访问权限」：Safari 缓存、系统日志及部分受保护目录可能无法完整剖析，可点击左侧按钮一键前往设置授权。".to_string()
            );
        }
    }

    SystemStatus {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        is_elevated,
        has_full_disk_access,
        window_chrome: if is_floating_chrome {
            "floating".to_string()
        } else {
            "native".to_string()
        },
        default_music_dir: dirs::audio_dir().map(|p| p.to_string_lossy().to_string()),
        disks,
        permission_warnings,
    }
}

fn dir_size_safe(path: &Path) -> (u64, usize) {
    let mut total = 0u64;
    let mut denied = 0usize;
    let mut count = 0usize;
    for entry in WalkDir::new(path).follow_links(false) {
        count += 1;
        if count > 45_000 {
            break;
        }
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

struct DomainBucket {
    id: &'static str,
    name: &'static str,
    subtitle: &'static str,
    description: &'static str,
    risk_level: &'static str,
    recommendation: &'static str,
    requires_privilege: bool,
    default_selected: bool,
    roots: HashSet<String>,
    items: Vec<ScannedItem>,
    total_bytes: u64,
    denied_count: usize,
}

impl DomainBucket {
    fn new(
        id: &'static str,
        name: &'static str,
        subtitle: &'static str,
        description: &'static str,
        risk_level: &'static str,
        recommendation: &'static str,
        requires_privilege: bool,
        default_selected: bool,
    ) -> Self {
        Self {
            id,
            name,
            subtitle,
            description,
            risk_level,
            recommendation,
            requires_privilege,
            default_selected,
            roots: HashSet::new(),
            items: Vec::new(),
            total_bytes: 0,
            denied_count: 0,
        }
    }

    fn push_item(&mut self, item: ScannedItem, root_hint: Option<&Path>) {
        if let Some(r) = root_hint {
            self.roots.insert(r.to_string_lossy().to_string());
        }
        self.total_bytes = self.total_bytes.saturating_add(item.size_bytes);
        self.items.push(item);
    }
}

fn init_domain_buckets() -> HashMap<&'static str, DomainBucket> {
    let mut map = HashMap::new();
    map.insert(
        "junk",
        DomainBucket::new(
            "junk",
            "无用废物与冗余残留",
            "系统临时碎片 · 浏览器缓存 · 残留安装包 · 重复副本",
            "经智能规则识别为可安全清理或高度冗余的垃圾文件，优先推荐一键瘦身。",
            "safe",
            "recommend",
            false,
            true,
        ),
    );
    map.insert(
        "dev_cache",
        DomainBucket::new(
            "dev_cache",
            "软件与开发构建缓存",
            "显卡着色器 · npm/pip/Cargo/Xcode · 社交缓存 · 过期依赖",
            "删除后下次启动对应软件可自动重建，适合需要快速腾出数 GB 空间时清理。",
            "caution",
            "review",
            false,
            false,
        ),
    );
    map.insert(
        "entertainment",
        DomainBucket::new(
            "entertainment",
            "娱乐、影音与游戏区",
            "高清电影番剧 · 本地音乐 · 游戏客户端与素材 · 电子书",
            "智能识别的休闲娱乐资源，默认不勾选；看完的大体积视频或弃坑游戏可手动清理。",
            "caution",
            "review",
            false,
            false,
        ),
    );
    map.insert(
        "life",
        DomainBucket::new(
            "life",
            "生活、照片与个人回忆",
            "相册原图 · 生活录像 · 微信/QQ 个人文件",
            "高价值个人生活资产，已自动开启防误删保护，清理弹窗中也会再次重点提示。",
            "protected",
            "protect",
            false,
            false,
        ),
    );
    map.insert(
        "work",
        DomainBucket::new(
            "work",
            "工作、学习与创作项目",
            "办公文档 PDF/Office · 设计剪辑工程 · 活跃代码资料",
            "重要学习与办公文件，默认保护不勾选，方便您直观盘点磁盘占用去向。",
            "protected",
            "protect",
            false,
            false,
        ),
    );
    map.insert(
        "system_elevated",
        DomainBucket::new(
            "system_elevated",
            "系统权限区与更新缓存",
            "Windows\\Temp · 更新补丁缓存 · macOS /Library 系统区",
            "涉及操作系统全局权限，清理前会强制拉响权限警报并等待您逐项审视放行。",
            "elevated",
            "review",
            true,
            false,
        ),
    );
    map
}

fn finalize_result(
    mut buckets: HashMap<&'static str, DomainBucket>,
    scope_label: String,
    started: Instant,
    app: &AppHandle,
) -> FullScanResult {
    let order = [
        "junk",
        "dev_cache",
        "entertainment",
        "life",
        "work",
        "system_elevated",
    ];

    let mut categories = Vec::new();
    let mut grand_bytes = 0u64;
    let mut grand_items = 0usize;
    let mut grand_denied = 0usize;
    let mut reclaimable_bytes = 0u64;
    let mut reclaimable_items = 0usize;
    let mut entertainment_bytes = 0u64;
    let mut life_bytes = 0u64;
    let mut work_bytes = 0u64;
    let mut system_bytes = 0u64;

    for key in order {
        if let Some(mut b) = buckets.remove(key) {
            // Sort by largest size first
            b.items.sort_by(|a, c| c.size_bytes.cmp(&a.size_bytes));
            if b.items.len() > 260 {
                b.items.truncate(260);
            }

            for it in &b.items {
                if it.recommendation == "recommend" {
                    reclaimable_bytes = reclaimable_bytes.saturating_add(it.size_bytes);
                    reclaimable_items += 1;
                }
            }

            match key {
                "entertainment" => entertainment_bytes = b.total_bytes,
                "life" => life_bytes = b.total_bytes,
                "work" => work_bytes = b.total_bytes,
                "system_elevated" => system_bytes = b.total_bytes,
                _ => {}
            }

            grand_bytes = grand_bytes.saturating_add(b.total_bytes);
            grand_items += b.items.len();
            grand_denied += b.denied_count;

            let mut roots: Vec<String> = b.roots.into_iter().collect();
            roots.sort();

            categories.push(ScanCategoryResult {
                id: b.id.to_string(),
                domain: b.id.to_string(),
                name: b.name.to_string(),
                subtitle: b.subtitle.to_string(),
                description: b.description.to_string(),
                risk_level: b.risk_level.to_string(),
                recommendation: b.recommendation.to_string(),
                requires_privilege: b.requires_privilege,
                default_selected: b.default_selected,
                root_paths: roots,
                total_bytes: b.total_bytes,
                item_count: b.items.len(),
                denied_count: b.denied_count,
                items: b.items,
            });
        }
    }

    // Compute intuitive disk cleanliness health score (45..100)
    let waste_mb = reclaimable_bytes / (1024 * 1024);
    let penalty = if waste_mb > 8192 {
        48
    } else if waste_mb > 3072 {
        34
    } else if waste_mb > 1024 {
        22
    } else if waste_mb > 300 {
        12
    } else if waste_mb > 50 {
        5
    } else {
        0
    };
    let health_score = (100u8).saturating_sub(penalty);

    let headline = if reclaimable_bytes > 500 * 1024 * 1024 {
        format!(
            "在「{}」中识别出 {} 项可直接清理的无用废物与残留，建议优先一键瘦身；生活与工作文件已自动保护。",
            scope_label, reclaimable_items
        )
    } else if grand_items > 0 {
        format!(
            "「{}」整体较整洁，已为您按废物 / 缓存 / 娱乐 / 生活 / 工作五大语义维度盘点归类。",
            scope_label
        )
    } else {
        format!("「{}」非常干净，暂未发现明显大体积文件或冗余垃圾。", scope_label)
    };

    let _ = app.emit(
        "scan-progress",
        ScanProgressPayload {
            stage: "智能盘点完成".to_string(),
            current_path: headline.clone(),
            found_bytes: grand_bytes,
            found_items: grand_items,
            progress_pct: 100,
        },
    );

    FullScanResult {
        categories,
        summary: SmartSummary {
            scope_label,
            health_score,
            headline,
            reclaimable_bytes,
            reclaimable_items,
            entertainment_bytes,
            life_bytes,
            work_bytes,
            system_bytes,
        },
        total_bytes: grand_bytes,
        total_items: grand_items,
        total_denied: grand_denied,
        duration_ms: started.elapsed().as_millis(),
    }
}

fn scan_cache_children(
    roots: Vec<PathBuf>,
    forced_domain: &'static str,
    buckets: &mut HashMap<&'static str, DomainBucket>,
    seen: &mut HashSet<String>,
    app: &AppHandle,
    stage_label: &str,
    pct: u8,
    running_bytes: &mut u64,
    running_items: &mut usize,
) {
    for root in existing_paths(roots) {
        let _ = app.emit(
            "scan-progress",
            ScanProgressPayload {
                stage: stage_label.to_string(),
                current_path: root.to_string_lossy().to_string(),
                found_bytes: *running_bytes,
                found_items: *running_items,
                progress_pct: pct,
            },
        );

        match std::fs::read_dir(&root) {
            Ok(rd) => {
                for entry_res in rd {
                    match entry_res {
                        Ok(entry) => {
                            let p = entry.path();
                            let p_str = p.to_string_lossy().to_string();
                            if !seen.insert(p_str.clone()) {
                                continue;
                            }
                            let ftype = match entry.file_type() {
                                Ok(ft) => ft,
                                Err(_) => {
                                    if let Some(b) = buckets.get_mut(forced_domain) {
                                        b.denied_count += 1;
                                    }
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
                            if sz == 0 && !ftype.is_dir() {
                                continue;
                            }
                            let m_ts = modified_unix(&p);
                            let cls = classify_entry(&p, ftype.is_dir(), sz, m_ts, Some(forced_domain));
                            if let Some(b) = buckets.get_mut(cls.domain) {
                                b.denied_count += sub_denied;
                                b.push_item(
                                    ScannedItem {
                                        path: p_str.clone(),
                                        name: entry.file_name().to_string_lossy().to_string(),
                                        size_bytes: sz,
                                        is_dir: ftype.is_dir(),
                                        modified_ts: m_ts,
                                        category_id: cls.domain.to_string(),
                                        domain: cls.domain.to_string(),
                                        recommendation: cls.recommendation.to_string(),
                                        ai_reason: cls.ai_reason,
                                        risk_level: cls.risk_level.to_string(),
                                        requires_privilege: cls.requires_privilege,
                                    },
                                    Some(&root),
                                );
                            }
                            *running_bytes = running_bytes.saturating_add(sz);
                            *running_items += 1;
                        }
                        Err(_) => {
                            if let Some(b) = buckets.get_mut(forced_domain) {
                                b.denied_count += 1;
                            }
                        }
                    }
                }
            }
            Err(_) => {
                if let Some(b) = buckets.get_mut(forced_domain) {
                    b.denied_count += 1;
                }
            }
        }
    }
}

fn scan_semantic_tree(
    roots: Vec<PathBuf>,
    max_depth: usize,
    min_file_bytes: u64,
    buckets: &mut HashMap<&'static str, DomainBucket>,
    seen: &mut HashSet<String>,
    app: &AppHandle,
    stage_label: &str,
    base_pct: u8,
    running_bytes: &mut u64,
    running_items: &mut usize,
) {
    let valid_roots = existing_paths(roots);
    let total_r = valid_roots.len().max(1);

    for (r_idx, root) in valid_roots.into_iter().enumerate() {
        let mut iter = WalkDir::new(&root).max_depth(max_depth).follow_links(false).into_iter();
        let mut visited = 0usize;

        while let Some(entry_res) = iter.next() {
            visited += 1;
            if visited > 60_000 {
                break;
            }
            match entry_res {
                Ok(e) => {
                    let p = e.path();
                    if e.depth() == 0 {
                        continue;
                    }
                    if e.file_type().is_symlink() {
                        continue;
                    }
                    if e.file_type().is_dir() {
                        if should_skip_during_broad_scan(p) {
                            iter.skip_current_dir();
                            continue;
                        }
                        let name_lower = e.file_name().to_string_lossy().to_lowercase();
                        if is_collapsible_dir_name(&name_lower) {
                            let p_str = p.to_string_lossy().to_string();
                            if seen.insert(p_str.clone()) {
                                let (sz, sub_denied) = dir_size_safe(p);
                                if sz >= 2 * 1024 * 1024 {
                                    let m_ts = modified_unix(p);
                                    let cls = classify_entry(p, true, sz, m_ts, None);
                                    if let Some(b) = buckets.get_mut(cls.domain) {
                                        b.denied_count += sub_denied;
                                        b.push_item(
                                            ScannedItem {
                                                path: p_str,
                                                name: e.file_name().to_string_lossy().to_string(),
                                                size_bytes: sz,
                                                is_dir: true,
                                                modified_ts: m_ts,
                                                category_id: cls.domain.to_string(),
                                                domain: cls.domain.to_string(),
                                                recommendation: cls.recommendation.to_string(),
                                                ai_reason: cls.ai_reason,
                                                risk_level: cls.risk_level.to_string(),
                                                requires_privilege: cls.requires_privilege,
                                            },
                                            Some(&root),
                                        );
                                    }
                                    *running_bytes = running_bytes.saturating_add(sz);
                                    *running_items += 1;
                                }
                            }
                            iter.skip_current_dir();
                            continue;
                        }
                        continue;
                    }

                    if !e.file_type().is_file() {
                        continue;
                    }
                    let sz = match e.metadata() {
                        Ok(m) => m.len(),
                        Err(_) => continue,
                    };
                    if sz < min_file_bytes {
                        continue;
                    }

                    let p_str = p.to_string_lossy().to_string();
                    if !seen.insert(p_str.clone()) {
                        continue;
                    }

                    let m_ts = modified_unix(p);
                    let cls = classify_entry(p, false, sz, m_ts, None);
                    if let Some(b) = buckets.get_mut(cls.domain) {
                        b.push_item(
                            ScannedItem {
                                path: p_str.clone(),
                                name: e.file_name().to_string_lossy().to_string(),
                                size_bytes: sz,
                                is_dir: false,
                                modified_ts: m_ts,
                                category_id: cls.domain.to_string(),
                                domain: cls.domain.to_string(),
                                recommendation: cls.recommendation.to_string(),
                                ai_reason: cls.ai_reason,
                                risk_level: cls.risk_level.to_string(),
                                requires_privilege: cls.requires_privilege,
                            },
                            Some(&root),
                        );
                    }
                    *running_bytes = running_bytes.saturating_add(sz);
                    *running_items += 1;

                    if *running_items % 20 == 0 {
                        let pct = (base_pct as usize + ((r_idx * 35) / total_r)).min(96) as u8;
                        let _ = app.emit(
                            "scan-progress",
                            ScanProgressPayload {
                                stage: stage_label.to_string(),
                                current_path: p_str,
                                found_bytes: *running_bytes,
                                found_items: *running_items,
                                progress_pct: pct,
                            },
                        );
                    }
                }
                Err(_) => {
                    if let Some(b) = buckets.get_mut("system_elevated") {
                        b.denied_count += 1;
                    }
                }
            }
        }
    }
}

/// Full intelligent audit: combines OS/App caches + semantic classification of user spaces (Life/Entertainment/Work/Junk)
pub fn run_full_scan(app: &AppHandle) -> FullScanResult {
    let started = Instant::now();
    let mut buckets = init_domain_buckets();
    let mut seen = HashSet::new();
    let mut running_bytes = 0u64;
    let mut running_items = 0usize;
    let home = dirs::home_dir().unwrap_or_default();

    #[cfg(target_os = "windows")]
    {
        let local_app = dirs::data_local_dir().unwrap_or_else(|| home.join("AppData\\Local"));
        let roaming = dirs::data_dir().unwrap_or_else(|| home.join("AppData\\Roaming"));
        let temp_env = std::env::temp_dir();

        // 1. Safe junk & browser caches
        scan_cache_children(
            vec![
                temp_env,
                local_app.join("Temp"),
                local_app.join("CrashDumps"),
                local_app.join("Google\\Chrome\\User Data\\Default\\Cache"),
                local_app.join("Google\\Chrome\\User Data\\Default\\Code Cache"),
                local_app.join("Microsoft\\Edge\\User Data\\Default\\Cache"),
                local_app.join("Microsoft\\Edge\\User Data\\Default\\Code Cache"),
                local_app.join("BraveSoftware\\Brave-Browser\\User Data\\Default\\Cache"),
                local_app.join("Mozilla\\Firefox\\Profiles"),
            ],
            "junk",
            &mut buckets,
            &mut seen,
            app,
            "正在识别系统临时碎片与浏览器缓存...",
            18,
            &mut running_bytes,
            &mut running_items,
        );

        // 2. Shader & dev & app caches
        scan_cache_children(
            vec![
                local_app.join("D3DSCache"),
                local_app.join("NVIDIA\\DXCache"),
                local_app.join("NVIDIA\\GLCache"),
                local_app.join("npm-cache"),
                local_app.join("pnpm-cache"),
                local_app.join("Yarn\\Cache"),
                local_app.join("pip\\Cache"),
                local_app.join("uv\\cache"),
                local_app.join("go-build"),
                roaming.join("npm-cache"),
                roaming.join("Code\\Cache"),
                roaming.join("Code\\CachedData"),
                roaming.join("Code\\CachedExtensionVSIXs"),
                roaming.join("Code\\logs"),
                home.join(".cargo\\registry\\cache"),
                home.join(".gradle\\caches"),
            ],
            "dev_cache",
            &mut buckets,
            &mut seen,
            app,
            "正在盘点显卡着色器与开发/软件缓存...",
            36,
            &mut running_bytes,
            &mut running_items,
        );

        // 3. Elevated system directories
        scan_cache_children(
            vec![
                PathBuf::from("C:\\Windows\\Temp"),
                PathBuf::from("C:\\Windows\\SoftwareDistribution\\Download"),
                PathBuf::from("C:\\Windows\\Minidump"),
                PathBuf::from("C:\\ProgramData\\Microsoft\\Windows\\WER\\ReportArchive"),
            ],
            "system_elevated",
            &mut buckets,
            &mut seen,
            app,
            "正在检查 C 盘系统权限区与更新缓存...",
            52,
            &mut running_bytes,
            &mut running_items,
        );
    }

    #[cfg(target_os = "macos")]
    {
        let lib = home.join("Library");

        scan_cache_children(
            vec![lib.join("Caches"), lib.join("Logs")],
            "junk",
            &mut buckets,
            &mut seen,
            app,
            "正在识别用户缓存与诊断日志...",
            20,
            &mut running_bytes,
            &mut running_items,
        );

        scan_cache_children(
            vec![
                lib.join("Developer/Xcode/DerivedData"),
                lib.join("Caches/Homebrew"),
                lib.join("Caches/pip"),
                lib.join("Caches/uv"),
                lib.join("Caches/Yarn"),
                lib.join("Caches/go-build"),
                lib.join("pnpm/store"),
                home.join(".npm/_cacache"),
                home.join(".cargo/registry/cache"),
                home.join(".gradle/caches"),
            ],
            "dev_cache",
            &mut buckets,
            &mut seen,
            app,
            "正在盘点 Xcode / Homebrew 与开发缓存...",
            40,
            &mut running_bytes,
            &mut running_items,
        );

        scan_cache_children(
            vec![PathBuf::from("/Library/Caches"), PathBuf::from("/Library/Logs")],
            "system_elevated",
            &mut buckets,
            &mut seen,
            app,
            "正在检查 macOS /Library 系统权限区...",
            54,
            &mut running_bytes,
            &mut running_items,
        );
    }

    // 4. Smart semantic analysis of all major user zones (Downloads, Desktop, Documents, Pictures, Videos, Music)
    let mut user_zones = Vec::new();
    if let Some(p) = dirs::download_dir() { user_zones.push(p); }
    if let Some(p) = dirs::desktop_dir() { user_zones.push(p); }
    if let Some(p) = dirs::document_dir() { user_zones.push(p); }
    if let Some(p) = dirs::picture_dir() { user_zones.push(p); }
    if let Some(p) = dirs::video_dir() { user_zones.push(p); }
    if let Some(p) = dirs::audio_dir() { user_zones.push(p); }

    scan_semantic_tree(
        user_zones,
        4,
        2 * 1024 * 1024, // 2 MB threshold for meaningful user-space files
        &mut buckets,
        &mut seen,
        app,
        "正在智能语义分类：区分生活、娱乐、工作与无用废物...",
        60,
        &mut running_bytes,
        &mut running_items,
    );

    finalize_result(buckets, "全盘智能体检".to_string(), started, app)
}

/// Smart semantic analysis for ANY selected disk (C:, D:, G:, /Volumes/...) or custom folder!
pub fn scan_custom_directory(
    app: &AppHandle,
    target_dir: &str,
    min_size_mb: u64,
) -> Result<FullScanResult, String> {
    let root = PathBuf::from(target_dir);
    if !root.exists() || !root.is_dir() {
        return Err("所选路径不存在或不是文件夹".to_string());
    }

    let started = Instant::now();
    let mut buckets = init_domain_buckets();
    let mut seen = HashSet::new();
    let mut running_bytes = 0u64;
    let mut running_items = 0usize;
    let min_bytes = min_size_mb.max(1).saturating_mul(1024 * 1024);

    scan_semantic_tree(
        vec![root],
        5,
        min_bytes,
        &mut buckets,
        &mut seen,
        app,
        &format!("正在对 {} 进行智能语义剖析...", target_dir),
        20,
        &mut running_bytes,
        &mut running_items,
    );

    Ok(finalize_result(
        buckets,
        format!("深度剖析 · {}", target_dir),
        started,
        app,
    ))
}
