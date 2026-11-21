use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiskSummary {
    pub name: String,
    pub mount_point: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    pub file_system: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatus {
    pub os: String,
    pub arch: String,
    pub is_elevated: bool,
    pub has_full_disk_access: bool,
    pub default_music_dir: Option<String>,
    pub disks: Vec<DiskSummary>,
    pub permission_warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScannedItem {
    pub path: String,
    pub name: String,
    pub size_bytes: u64,
    pub is_dir: bool,
    pub modified_ts: u64,
    pub category_id: String,
    pub risk_level: String,
    pub requires_privilege: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanCategoryResult {
    pub id: String,
    pub name: String,
    pub description: String,
    pub risk_level: String, // "safe" | "caution" | "elevated"
    pub requires_privilege: bool,
    pub default_selected: bool,
    pub root_paths: Vec<String>,
    pub total_bytes: u64,
    pub item_count: usize,
    pub denied_count: usize,
    pub items: Vec<ScannedItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullScanResult {
    pub categories: Vec<ScanCategoryResult>,
    pub total_bytes: u64,
    pub total_items: usize,
    pub total_denied: usize,
    pub duration_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanProgressPayload {
    pub stage: String,
    pub current_path: String,
    pub found_bytes: u64,
    pub found_items: usize,
    pub progress_pct: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanProgressPayload {
    pub current_path: String,
    pub processed: usize,
    pub total: usize,
    pub freed_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkippedEntry {
    pub path: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanReport {
    pub mode: String, // "recycle" | "permanent"
    pub deleted_count: usize,
    pub skipped_count: usize,
    pub freed_bytes: u64,
    pub skipped_items: Vec<SkippedEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicTrack {
    pub path: String,
    pub title: String,
    pub folder: String,
    pub ext: String,
    pub size_bytes: u64,
}
