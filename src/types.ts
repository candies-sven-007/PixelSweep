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
  window_chrome: "floating" | "native" | string;
  default_music_dir: string | null;
  disks: DiskSummary[];
  permission_warnings: string[];
}

export type SmartDomain =
  | "junk"
  | "dev_cache"
  | "entertainment"
  | "life"
  | "work"
  | "system_elevated";

export interface ScannedItem {
  path: string;
  name: string;
  size_bytes: number;
  is_dir: boolean;
  modified_ts: number;
  category_id: string;
  domain: SmartDomain | string;
  recommendation: "recommend" | "review" | "protect" | string;
  ai_reason: string;
  risk_level: "safe" | "caution" | "protected" | "elevated" | string;
  requires_privilege: boolean;
}

export interface ScanCategoryResult {
  id: string;
  domain: SmartDomain | string;
  name: string;
  subtitle: string;
  description: string;
  risk_level: "safe" | "caution" | "protected" | "elevated" | string;
  recommendation: "recommend" | "review" | "protect" | string;
  requires_privilege: boolean;
  default_selected: boolean;
  root_paths: string[];
  total_bytes: number;
  item_count: number;
  denied_count: number;
  items: ScannedItem[];
}

export interface SmartSummary {
  scope_label: string;
  health_score: number;
  headline: string;
  reclaimable_bytes: number;
  reclaimable_items: number;
  entertainment_bytes: number;
  life_bytes: number;
  work_bytes: number;
  system_bytes: number;
}

export interface FullScanResult {
  categories: ScanCategoryResult[];
  summary: SmartSummary;
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

export function formatRelativeTime(unixSec: number): string {
  if (!unixSec || unixSec <= 0) return "";
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
  if (diffSec < 3600) return `${Math.max(1, Math.floor(diffSec / 60))}分钟前`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}小时前`;
  const days = Math.floor(diffSec / 86400);
  if (days < 30) return `${days}天前`;
  if (days < 365) return `${Math.floor(days / 30)}个月前`;
  return `${Math.floor(days / 365)}年前`;
}

export function getCategoryColor(domain: string): string {
  const palette: Record<string, string> = {
    junk: "#10b981",            // Emerald — Safe waste to sweep
    dev_cache: "#6366f1",       // Indigo — Rebuildable caches
    entertainment: "#ec4899",   // Rose/Pink — Games, movies, music
    life: "#f97316",            // Warm Orange — Photos & personal memories
    work: "#0ea5e9",            // Sky Blue — Documents & code projects
    system_elevated: "#f59e0b", // Amber — System privilege area
  };
  return palette[domain] ?? "#0a84ff";
}

export function getDomainShortLabel(domain: string): string {
  const labels: Record<string, string> = {
    junk: "无用废物",
    dev_cache: "软件缓存",
    entertainment: "娱乐影音",
    life: "生活回忆",
    work: "工作学习",
    system_elevated: "系统权限",
  };
  return labels[domain] ?? domain;
}
