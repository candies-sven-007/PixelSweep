export interface DiskSummary {
  name: string;
  mount_point: string;
  total_bytes: number;
  available_bytes: number;
  used_bytes: number;
  file_system: string;
}

export interface SystemStatus {
  os: string;
  arch: string;
  is_elevated: boolean;
  has_full_disk_access: boolean;
  default_music_dir: string | null;
  disks: DiskSummary[];
  permission_warnings: string[];
}

export interface ScannedItem {
  path: string;
  name: string;
  size_bytes: number;
  is_dir: boolean;
  modified_ts: number;
  category_id: string;
  risk_level: "safe" | "caution" | "elevated" | string;
  requires_privilege: boolean;
}

export interface ScanCategoryResult {
  id: string;
  name: string;
  description: string;
  risk_level: "safe" | "caution" | "elevated" | string;
  requires_privilege: boolean;
  default_selected: boolean;
  root_paths: string[];
  total_bytes: number;
  item_count: number;
  denied_count: number;
  items: ScannedItem[];
}

export interface FullScanResult {
  categories: ScanCategoryResult[];
  total_bytes: number;
  total_items: number;
  total_denied: number;
  duration_ms: number;
}

export interface ScanProgressPayload {
  stage: string;
  current_path: string;
  found_bytes: number;
  found_items: number;
  progress_pct: number;
}

export interface CleanProgressPayload {
  current_path: string;
  processed: number;
  total: number;
  freed_bytes: number;
}

export interface SkippedEntry {
  path: string;
  reason: string;
}

export interface CleanReport {
  mode: "recycle" | "permanent" | string;
  deleted_count: number;
  skipped_count: number;
  freed_bytes: number;
  skipped_items: SkippedEntry[];
}

export interface MusicTrack {
  path: string;
  title: string;
  folder: string;
  ext: string;
  size_bytes: number;
}

export type CharacterMood = "idle" | "scanning" | "auditing" | "cleaning" | "done";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, idx);
  return `${val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2)} ${units[idx]}`;
}
