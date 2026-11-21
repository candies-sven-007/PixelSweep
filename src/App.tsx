import React, { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open } from "@tauri-apps/plugin-dialog";
import {
  CharacterMood,
  CleanProgressPayload,
  CleanReport,
  FullScanResult,
  MusicTrack,
  ScanCategoryResult,
  ScanProgressPayload,
  ScannedItem,
  SystemStatus,
  formatBytes,
} from "./types";
import { PixelFarmerStage } from "./components/PixelFarmerStage";
import { AuditModal } from "./components/AuditModal";
import { MusicDock } from "./components/MusicDock";
import {
  PixelBroomIcon,
  PixelFolderIcon,
  PixelMagnifierIcon,
  PixelShieldAlertIcon,
  PixelTrashIcon,
} from "./components/PixelIcons";

export const App: React.FC = () => {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mood, setMood] = useState<CharacterMood>("idle");
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  // Scan state
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressPayload | null>(null);
  const [cleanProgress, setCleanProgress] = useState<CleanProgressPayload | null>(null);
  const [categories, setCategories] = useState<ScanCategoryResult[]>([]);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  const [cleanMode, setCleanMode] = useState<"recycle" | "permanent">("recycle");

  // Modal & Reports
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [lastReport, setLastReport] = useState<CleanReport | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Music state
  const [musicDir, setMusicDir] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 4500);
  }, []);

  const refreshSystem = useCallback(async () => {
    try {
      const status = await invoke<SystemStatus>("get_system_status");
      setSysStatus(status);
    } catch (e) {
      showToast(`获取系统磁盘状态失败: ${String(e)}`);
    }
  }, [showToast]);

  const loadMusic = useCallback(
    async (customFolder?: string) => {
      try {
        const [dir, list] = await invoke<[string, MusicTrack[]]>("load_local_music", {
          folder: customFolder ?? null,
        });
        setMusicDir(dir);
        setTracks(list);
      } catch {
        // Silent on startup if Music dir doesn't exist
      }
    },
    []
  );

  useEffect(() => {
    refreshSystem();
    loadMusic();

    const unlistenScan = listen<ScanProgressPayload>("scan-progress", (e) => {
      setScanProgress(e.payload);
    });
    const unlistenClean = listen<CleanProgressPayload>("clean-progress", (e) => {
      setCleanProgress(e.payload);
    });

    return () => {
      unlistenScan.then((f) => f());
      unlistenClean.then((f) => f());
    };
  }, [refreshSystem, loadMusic]);

  const handleFullScan = async () => {
    if (isScanning || isCleaning) return;
    setIsScanning(true);
    setLastReport(null);
    setMood("scanning");
    try {
      const res = await invoke<FullScanResult>("start_full_scan");
      setCategories(res.categories);
      const nextSelected: Record<string, boolean> = {};
      for (const cat of res.categories) {
        if (cat.default_selected) {
          for (const it of cat.items) {
            nextSelected[it.path] = true;
          }
        }
      }
      setSelectedPaths(nextSelected);
      if (res.categories.length > 0) {
        setExpandedCat(res.categories[0].id);
      }
      setMood("idle");
      showToast(
        `扫描完成：发现 ${res.total_items} 项，共 ${formatBytes(res.total_bytes)}（耗时 ${(
          res.duration_ms / 1000
        ).toFixed(1)}s）`
      );
    } catch (e) {
      setMood("idle");
      showToast(`扫描异常: ${String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCustomFolderScan = async () => {
    if (isScanning || isCleaning) return;
    const picked = await open({ directory: true, multiple: false, title: "选择要深度排查的磁盘或文件夹" });
    if (!picked || typeof picked !== "string") return;

    setIsScanning(true);
    setMood("scanning");
    try {
      const customCat = await invoke<ScanCategoryResult>("scan_custom_folder", {
        targetDir: picked,
        minSizeMb: 50,
      });
      setCategories((prev) => [customCat, ...prev.filter((c) => c.id !== "custom_scan")]);
      setExpandedCat(customCat.id);
      setMood("idle");
      showToast(`自定义目录扫描完成：发现 ${customCat.item_count} 个大文件（共 ${formatBytes(customCat.total_bytes)}）`);
    } catch (e) {
      setMood("idle");
      showToast(`自定义扫描失败: ${String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handlePickMusicFolder = async () => {
    const picked = await open({ directory: true, multiple: false, title: "选择本地音乐文件夹" });
    if (!picked || typeof picked !== "string") return;
    await loadMusic(picked);
    showToast("已切换本地音乐库");
  };

  const selectedItems: ScannedItem[] = useMemo(() => {
    const out: ScannedItem[] = [];
    for (const cat of categories) {
      for (const it of cat.items) {
        if (selectedPaths[it.path]) out.push(it);
      }
    }
    return out;
  }, [categories, selectedPaths]);

  const selectedTotalBytes = useMemo(
    () => selectedItems.reduce((acc, it) => acc + it.size_bytes, 0),
    [selectedItems]
  );

  const toggleCategory = (cat: ScanCategoryResult) => {
    const allChecked = cat.items.length > 0 && cat.items.every((it) => selectedPaths[it.path]);
    setSelectedPaths((prev) => {
      const next = { ...prev };
      for (const it of cat.items) {
        next[it.path] = !allChecked;
      }
      return next;
    });
  };

  const toggleItem = (path: string) => {
    setSelectedPaths((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const openAuditFlow = () => {
    if (selectedItems.length === 0) {
      showToast("请先勾选需要清理的缓存或文件");
      return;
    }
    setMood("auditing");
    setShowAuditModal(true);
  };

  const handleConfirmedClean = async (approvedPaths: string[], mode: "recycle" | "permanent") => {
    setShowAuditModal(false);
    setIsCleaning(true);
    setMood("cleaning");
    try {
      const report = await invoke<CleanReport>("execute_cleanup", {
        paths: approvedPaths,
        mode,
      });
      setLastReport(report);
      // Remove cleaned paths from UI state
      const skippedSet = new Set(report.skipped_items.map((s) => s.path));
      const deletedSet = new Set(approvedPaths.filter((p) => !skippedSet.has(p)));

      setCategories((prev) =>
        prev.map((cat) => {
          const remaining = cat.items.filter((it) => !deletedSet.has(it.path));
          return {
            ...cat,
            items: remaining,
            item_count: remaining.length,
            total_bytes: remaining.reduce((acc, x) => acc + x.size_bytes, 0),
          };
        })
      );
      setSelectedPaths((prev) => {
        const next = { ...prev };
        for (const p of deletedSet) delete next[p];
        return next;
      });
      setMood("done");
      await refreshSystem();
      showToast(
        `清理完成：已${mode === "permanent" ? "彻底删除" : "移入回收站"} ${report.deleted_count} 项，释放 ${formatBytes(
          report.freed_bytes
        )}`
      );
    } catch (e) {
      setMood("idle");
      showToast(`清理失败: ${String(e)}`);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleEmptyTrash = async () => {
    const ok = window.confirm("确认彻底清空系统回收站 / 废纸篓吗？清空后文件将无法恢复。");
    if (!ok) return;
    try {
      setMood("cleaning");
      const msg = await invoke<string>("empty_trash");
      setMood("done");
      await refreshSystem();
      showToast(msg);
    } catch (e) {
      setMood("idle");
      showToast(`清空失败: ${String(e)}`);
    }
  };

  const isMac = sysStatus?.os === "macos";

  const stageTitle = isScanning
    ? scanProgress?.stage || "正在深度巡检磁盘..."
    : isCleaning
    ? `正在清扫 (${cleanProgress?.processed ?? 0}/${cleanProgress?.total ?? 0})`
    : lastReport
    ? `本次已释放 ${formatBytes(lastReport.freed_bytes)}`
    : categories.length > 0
    ? `已选 ${selectedItems.length} 项 · 预计释放 ${formatBytes(selectedTotalBytes)}`
    : "戴上耳机，轻松清扫磁盘空间";

  const stageSub = isScanning
    ? scanProgress?.current_path || "放大镜巡检缓存与大文件中..."
    : isCleaning
    ? cleanProgress?.current_path || "小农夫正在挥舞扫帚清理垃圾..."
    : lastReport
    ? `模式：${lastReport.mode === "permanent" ? "直接彻底删除" : "移入系统回收站"} · 成功 ${
        lastReport.deleted_count
      } 项 · 跳过 ${lastReport.skipped_count} 项`
    : "支持先移入回收站或彻底删除；涉及系统级权限项将在清理前主动报警并等待您审视。";

  const win = getCurrentWindow();

  return (
    <div className={`app-shell theme-${theme}`}>
      {/* Frosted Glass Titlebar */}
      <header className="titlebar" data-tauri-drag-region>
        <div className={`titlebar-left ${isMac ? "mac-inset" : ""}`} data-tauri-drag-region>
          <PixelBroomIcon size={20} />
          <span className="brand-name">PixelSweep</span>
          <span className="brand-badge">
            {sysStatus ? `${sysStatus.os.toUpperCase()} · ${sysStatus.arch}` : "Glass Edition"}
          </span>
        </div>

        <div className="titlebar-right">
          <button
            className="glass-chip"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
            title="切换浅色/深色软玻璃主题"
          >
            {theme === "light" ? "☀ 浅霜玻璃" : "☾ 暗夜磨砂"}
          </button>

          {!isMac && (
            <div className="win-controls">
              <button className="win-btn" onClick={() => win.minimize()} title="最小化">
                ─
              </button>
              <button className="win-btn" onClick={() => win.toggleMaximize()} title="最大化">
                ▢
              </button>
              <button className="win-btn win-close" onClick={() => win.close()} title="关闭">
                ✕
              </button>
            </div>
          )}
        </div>
      </header>

      {toastMsg && <div className="glass-toast">{toastMsg}</div>}

      {/* Main Layout */}
      <div className="workspace">
        {/* Left Translucent Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="section-label">磁盘空间概览</div>
            <div className="disk-list">
              {(sysStatus?.disks ?? []).map((d) => {
                const pct = Math.min(100, Math.round((d.used_bytes / Math.max(1, d.total_bytes)) * 100));
                return (
                  <div key={d.mount_point} className="disk-card">
                    <div className="disk-top">
                      <strong>{d.mount_point}</strong>
                      <span className="disk-pct">{pct}%</span>
                    </div>
                    <div className="disk-bar">
                      <div
                        className={`disk-fill ${pct > 85 ? "fill-high" : ""}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="disk-meta">
                      可用 {formatBytes(d.available_bytes)} / 共 {formatBytes(d.total_bytes)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">权限与安全守卫</div>
            <div className="perm-card">
              <div className="perm-row">
                <span>管理员/Root 权限</span>
                <span className={sysStatus?.is_elevated ? "badge-ok" : "badge-warn"}>
                  {sysStatus?.is_elevated ? "已提权" : "标准用户"}
                </span>
              </div>
              {isMac && (
                <div className="perm-row">
                  <span>完全磁盘访问</span>
                  <span className={sysStatus?.has_full_disk_access ? "badge-ok" : "badge-warn"}>
                    {sysStatus?.has_full_disk_access ? "已授权" : "未授权"}
                  </span>
                </div>
              )}
              <button
                className="btn-glass btn-full"
                onClick={() => invoke("open_permission_settings")}
              >
                <PixelShieldAlertIcon size={15} /> 打开系统权限设置
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <div className="section-label">快捷工具</div>
            <button className="btn-glass btn-full" onClick={handleCustomFolderScan} disabled={isScanning || isCleaning}>
              <PixelFolderIcon size={15} /> 自定义扫盘 / 选定目录
            </button>
            <button className="btn-glass btn-full" onClick={handleEmptyTrash} disabled={isScanning || isCleaning}>
              <PixelTrashIcon size={15} /> 清空系统回收站 / 废纸篓
            </button>
          </div>
        </aside>

        {/* Right Primary Glass Stage */}
        <main className="main-pane">
          {/* Permission Warning Banner if any */}
          {sysStatus && sysStatus.permission_warnings.length > 0 && (
            <div className="sys-warning-strip">
              <PixelShieldAlertIcon size={18} />
              <div className="sys-warning-text">{sysStatus.permission_warnings[0]}</div>
            </div>
          )}

          {/* Pixel Farmer Interactive Hero */}
          <div className="hero-panel">
            <PixelFarmerStage
              mood={mood}
              isPlayingMusic={isPlayingMusic}
              statusLine={stageTitle}
              subLine={stageSub}
            />
            <div className="hero-actions">
              <button
                className="btn-primary btn-lg"
                onClick={handleFullScan}
                disabled={isScanning || isCleaning}
              >
                <PixelMagnifierIcon size={18} />
                {isScanning ? "正在扫盘..." : "一键深度扫盘"}
              </button>
              <button
                className="btn-accent btn-lg"
                onClick={openAuditFlow}
                disabled={isScanning || isCleaning || selectedItems.length === 0}
              >
                <PixelBroomIcon size={18} />
                审视并清理 ({formatBytes(selectedTotalBytes)})
              </button>
            </div>
          </div>

          {/* Scan Progress Bar */}
          {isScanning && scanProgress && (
            <div className="progress-panel">
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${scanProgress.progress_pct}%` }} />
              </div>
              <div className="progress-caption">
                <span>已发现 {scanProgress.found_items} 项 · {formatBytes(scanProgress.found_bytes)}</span>
                <span>{scanProgress.progress_pct}%</span>
              </div>
            </div>
          )}

          {/* Detailed Categories & Items */}
          <div className="categories-wrap">
            {categories.length === 0 ? (
              <div className="empty-state">
                <PixelMagnifierIcon size={36} />
                <h3>点击「一键深度扫盘」开始体检</h3>
                <p>
                  将自动分项检测用户临时文件、浏览器缓存、开发工具缓存、系统级目录及大文件。
                  所有高危与系统级目录均经过安全锁保护，并会在清理前弹窗供您逐项审视。
                </p>
              </div>
            ) : (
              categories.map((cat) => {
                const checkedCount = cat.items.filter((it) => selectedPaths[it.path]).length;
                const isExpanded = expandedCat === cat.id;
                const allChecked = cat.items.length > 0 && checkedCount === cat.items.length;

                return (
                  <div key={cat.id} className="cat-card">
                    <div className="cat-header">
                      <label className="cat-check" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={allChecked}
                          disabled={cat.items.length === 0}
                          onChange={() => toggleCategory(cat)}
                        />
                      </label>
                      <div
                        className="cat-main"
                        onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                      >
                        <div className="cat-title-line">
                          <strong>{cat.name}</strong>
                          <span className={`risk-tag risk-${cat.risk_level}`}>
                            {cat.risk_level === "safe"
                              ? "安全缓存"
                              : cat.risk_level === "elevated"
                              ? "⚠ 系统权限项"
                              : "需人工审核"}
                          </span>
                          {cat.denied_count > 0 && (
                            <span className="denied-tag">{cat.denied_count} 项无权访问</span>
                          )}
                        </div>
                        <p className="cat-desc">{cat.description}</p>
                      </div>
                      <div
                        className="cat-stats"
                        onClick={() => setExpandedCat(isExpanded ? null : cat.id)}
                      >
                        <strong>{formatBytes(cat.total_bytes)}</strong>
                        <span>
                          已选 {checkedCount}/{cat.item_count} 项 {isExpanded ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="cat-items">
                        {cat.items.length === 0 ? (
                          <div className="cat-empty">该分类下暂未发现可清理内容</div>
                        ) : (
                          cat.items.map((it) => (
                            <div key={it.path} className="item-row">
                              <input
                                type="checkbox"
                                checked={!!selectedPaths[it.path]}
                                onChange={() => toggleItem(it.path)}
                              />
                              <div className="item-info">
                                <div className="item-name">
                                  {it.is_dir ? "📁 " : "📄 "}
                                  {it.name}
                                  {it.requires_privilege && (
                                    <span className="tag-elevated">权限报警项</span>
                                  )}
                                </div>
                                <div className="item-path" title={it.path}>
                                  {it.path}
                                </div>
                              </div>
                              <span className="item-size">{formatBytes(it.size_bytes)}</span>
                              <button
                                className="btn-link"
                                onClick={() => invoke("reveal_in_explorer", { path: it.path })}
                              >
                                定位
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>

      {/* Persistent Apple-Style Frosted Glass Local Music Player Dock */}
      <MusicDock
        musicDir={musicDir}
        tracks={tracks}
        onPickMusicFolder={handlePickMusicFolder}
        onPlayStateChange={setIsPlayingMusic}
      />

      {/* Pre-Deletion Security Alarm & Audit Modal */}
      {showAuditModal && (
        <AuditModal
          items={selectedItems}
          mode={cleanMode}
          onModeChange={setCleanMode}
          onCancel={() => {
            setShowAuditModal(false);
            setMood("idle");
          }}
          onConfirm={handleConfirmedClean}
        />
      )}
    </div>
  );
};
export default App;
