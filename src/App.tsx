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
import { StorageBreakdownBar } from "./components/StorageBreakdownBar";
import { CategoryAccordion } from "./components/CategoryAccordion";
import { AuditModal } from "./components/AuditModal";
import { MusicDock } from "./components/MusicDock";
import {
  PixelBroomIcon,
  PixelMagnifierIcon,
  PixelShieldAlertIcon,
  PixelTrashIcon,
} from "./components/PixelIcons";
import {
  FolderVectorIcon,
  HardDriveIcon,
  MoonIcon,
  RefreshIcon,
  SearchIcon,
  SunIcon,
  WinCloseIcon,
  WinMaxIcon,
  WinMinIcon,
} from "./components/UiIcons";

const PREVIEW_MODULES = [
  {
    title: "用户临时与安装包残留",
    tag: "安全缓存",
    risk: "safe",
    color: "#10b981",
    desc: "深度排查系统 Temp 与应用临时解压目录，不影响个人文档。",
  },
  {
    title: "主流浏览器网页缓存",
    tag: "安全缓存",
    risk: "safe",
    color: "#0ea5e9",
    desc: "清理 Chrome / Edge / Brave / Firefox 静态缓存，保留书签与密码。",
  },
  {
    title: "显卡着色器与开发缓存",
    tag: "需人工审核",
    risk: "caution",
    color: "#6366f1",
    desc: "定位 DirectX / NVIDIA / Xcode / npm / pnpm / pip / uv / Cargo 冗余缓存。",
  },
  {
    title: "崩溃转储与诊断日志",
    tag: "安全缓存",
    risk: "safe",
    color: "#8b5cf6",
    desc: "回收程序异常闪退生成的 .dmp 转储文件与陈旧诊断报告。",
  },
  {
    title: "系统根目录与更新缓存",
    tag: "系统权限项",
    risk: "elevated",
    color: "#f59e0b",
    desc: "涉及 C:\\Windows\\Temp 或 /Library 系统区，清理前强制报警审核。",
  },
  {
    title: "大文件深度雷达 (>100MB)",
    tag: "需人工审核",
    risk: "caution",
    color: "#ec4899",
    desc: "揪出下载目录与桌面沉睡的大型安装包、镜像与压缩包，默认不勾选。",
  },
];

const LIFETIME_KEY = "pixelsweep_lifetime_freed_bytes";

export const App: React.FC = () => {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [mood, setMood] = useState<CharacterMood>("idle");
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  // Scan & filter state
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressPayload | null>(null);
  const [cleanProgress, setCleanProgress] = useState<CleanProgressPayload | null>(null);
  const [categories, setCategories] = useState<ScanCategoryResult[]>([]);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  const [cleanMode, setCleanMode] = useState<"recycle" | "permanent">("recycle");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"size" | "name">("size");
  const [riskFilter, setRiskFilter] = useState<"all" | "safe" | "elevated" | "caution">("all");

  // Modal & Reports
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [lastReport, setLastReport] = useState<CleanReport | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [lifetimeFreed, setLifetimeFreed] = useState<number>(() => {
    const raw = window.localStorage.getItem(LIFETIME_KEY);
    return raw ? Number(raw) || 0 : 0;
  });

  // Music state
  const [musicDir, setMusicDir] = useState<string | null>(null);
  const [tracks, setTracks] = useState<MusicTrack[]>([]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 4200);
  }, []);

  const refreshSystem = useCallback(async () => {
    try {
      const status = await invoke<SystemStatus>("get_system_status");
      setSysStatus(status);
    } catch (e) {
      showToast(`获取系统磁盘状态失败: ${String(e)}`);
    }
  }, [showToast]);

  const loadMusic = useCallback(async (customFolder?: string) => {
    try {
      const [dir, list] = await invoke<[string, MusicTrack[]]>("load_local_music", {
        folder: customFolder ?? null,
      });
      setMusicDir(dir);
      setTracks(list);
    } catch {
      // Silent on startup if Music dir doesn't exist
    }
  }, []);

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

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      invoke("set_window_theme", { dark: next === "dark" }).catch(() => {});
      return next;
    });
  };

  const handleFullScan = async () => {
    if (isScanning || isCleaning) return;
    setIsScanning(true);
    setLastReport(null);
    setRiskFilter("all");
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
      const firstNonEmpty = res.categories.find((c) => c.items.length > 0) ?? res.categories[0];
      if (firstNonEmpty) {
        setExpandedMap({ [firstNonEmpty.id]: true });
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

  const scanSpecificPath = async (targetPath: string, minMb = 50) => {
    if (isScanning || isCleaning) return;
    setIsScanning(true);
    setMood("scanning");
    try {
      const customCat = await invoke<ScanCategoryResult>("scan_custom_folder", {
        targetDir: targetPath,
        minSizeMb: minMb,
      });
      setCategories((prev) => [customCat, ...prev.filter((c) => c.id !== "custom_scan")]);
      setRiskFilter("all");
      setExpandedMap((prev) => ({ ...prev, [customCat.id]: true }));
      setMood("idle");
      showToast(
        `目录扫描完成：发现 ${customCat.item_count} 个大文件（共 ${formatBytes(
          customCat.total_bytes
        )}）`
      );
    } catch (e) {
      setMood("idle");
      showToast(`扫描失败: ${String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCustomFolderScan = async () => {
    if (isScanning || isCleaning) return;
    const picked = await open({
      directory: true,
      multiple: false,
      title: "选择要深度排查的磁盘或文件夹",
    });
    if (!picked || typeof picked !== "string") return;
    await scanSpecificPath(picked, 50);
  };

  const handlePickMusicFolder = async () => {
    const picked = await open({
      directory: true,
      multiple: false,
      title: "选择本地音乐文件夹",
    });
    if (!picked || typeof picked !== "string") return;
    await loadMusic(picked);
    showToast("已切换本地音乐库");
  };

  const grandTotalBytes = useMemo(
    () => categories.reduce((acc, c) => acc + c.total_bytes, 0),
    [categories]
  );

  const visibleCategories = useMemo(() => {
    if (riskFilter === "all") return categories;
    return categories.filter((c) => c.risk_level === riskFilter);
  }, [categories, riskFilter]);

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

  const selectSafeOnly = () => {
    const next: Record<string, boolean> = {};
    for (const cat of categories) {
      if (cat.risk_level === "safe") {
        for (const it of cat.items) next[it.path] = true;
      }
    }
    setSelectedPaths(next);
    showToast("已应用「安全轻扫」方案");
  };

  const clearSelection = () => {
    setSelectedPaths({});
    showToast("已清空全部勾选");
  };

  const setAllExpanded = (openAll: boolean) => {
    const next: Record<string, boolean> = {};
    for (const cat of categories) next[cat.id] = openAll;
    setExpandedMap(next);
  };

  const focusCategory = (catId: string) => {
    setRiskFilter("all");
    setExpandedMap((prev) => ({ ...prev, [catId]: true }));
    window.setTimeout(() => {
      const el = document.getElementById(`cat-card-${catId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 60);
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
      if (report.freed_bytes > 0) {
        setLifetimeFreed((prev) => {
          const updated = prev + report.freed_bytes;
          window.localStorage.setItem(LIFETIME_KEY, String(updated));
          return updated;
        });
      }

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
        `清理完成：已${mode === "permanent" ? "彻底删除" : "移入回收站"} ${
          report.deleted_count
        } 项，释放 ${formatBytes(report.freed_bytes)}`
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
    ? cleanProgress?.current_path || "小农夫和森林芽灵正在合力清扫垃圾..."
    : lastReport
    ? `模式：${lastReport.mode === "permanent" ? "直接彻底删除" : "移入系统回收站"} · 成功 ${
        lastReport.deleted_count
      } 项 · 跳过 ${lastReport.skipped_count} 项`
    : "支持先移入回收站或彻底删除；涉及系统级权限项将在清理前主动报警并等待您审视。";

  const win = getCurrentWindow();

  return (
    <div className={`app-shell theme-${theme}`}>
      {/* Frosted Glass Micro-Grain + Ambient Liquid Orbs */}
      <div className="ambient-mesh" aria-hidden>
        <span className="orb orb-1" />
        <span className="orb orb-2" />
        <span className="orb orb-3" />
      </div>
      <div className="glass-noise-overlay" aria-hidden />

      {/* Unified Translucent Titlebar */}
      <header className="titlebar" data-tauri-drag-region>
        <div className={`titlebar-left ${isMac ? "mac-inset" : ""}`} data-tauri-drag-region>
          <div className="brand-icon-wrap">
            <PixelBroomIcon size={18} />
          </div>
          <span className="brand-name">PixelSweep</span>
          <span className="brand-badge">v1.2</span>
          {sysStatus && (
            <span className="brand-env">
              {sysStatus.os === "windows" ? "Windows" : "macOS"} · {sysStatus.arch}
            </span>
          )}
        </div>

        <div className="titlebar-right">
          {lifetimeFreed > 0 && (
            <span className="lifetime-pill" title="累计已清理释放的磁盘空间">
              累计已释放 <strong>{formatBytes(lifetimeFreed)}</strong>
            </span>
          )}

          <button
            className="glass-chip"
            onClick={toggleTheme}
            title="切换浅霜玻璃 / 暗夜磨砂主题"
          >
            {theme === "light" ? <SunIcon size={13} /> : <MoonIcon size={13} />}
            <span>{theme === "light" ? "浅霜玻璃" : "暗夜磨砂"}</span>
          </button>

          {!isMac && (
            <div className="win-controls">
              <button className="win-btn" onClick={() => win.minimize()} title="最小化">
                <WinMinIcon />
              </button>
              <button className="win-btn" onClick={() => win.toggleMaximize()} title="最大化">
                <WinMaxIcon />
              </button>
              <button className="win-btn win-close" onClick={() => win.close()} title="关闭">
                <WinCloseIcon />
              </button>
            </div>
          )}
        </div>
      </header>

      {toastMsg && <div className="glass-toast">{toastMsg}</div>}

      {/* Main Split Workspace */}
      <div className="workspace">
        {/* Left Apple-Style Translucent Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-section">
            <div className="section-head">
              <span className="section-label">磁盘空间概览（点击直扫大文件）</span>
              <button className="tiny-icon-btn" onClick={refreshSystem} title="刷新磁盘容量">
                <RefreshIcon size={12} />
              </button>
            </div>
            <div className="disk-list">
              {(sysStatus?.disks ?? []).map((d) => {
                const pct = Math.min(
                  100,
                  Math.round((d.used_bytes / Math.max(1, d.total_bytes)) * 100)
                );
                return (
                  <button
                    key={d.mount_point}
                    type="button"
                    className="disk-card clickable-disk"
                    disabled={isScanning || isCleaning}
                    onClick={() => scanSpecificPath(d.mount_point, 100)}
                    title={`点击排查 ${d.mount_point} 中大于 100MB 的大文件`}
                  >
                    <div className="disk-top">
                      <span className="disk-mount">
                        <HardDriveIcon size={13} />
                        <strong>{d.mount_point}</strong>
                      </span>
                      <span className={`disk-pct ${pct > 85 ? "pct-high" : ""}`}>{pct}%</span>
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
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sidebar-section">
            <span className="section-label">权限与安全守卫</span>
            <div className="perm-card">
              <div className="perm-row">
                <span>管理员 / Root</span>
                <span className={sysStatus?.is_elevated ? "badge-ok" : "badge-warn"}>
                  {sysStatus?.is_elevated ? "已授权" : "标准用户"}
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
            <span className="section-label">快捷工具</span>
            <button
              className="btn-glass btn-full"
              onClick={handleCustomFolderScan}
              disabled={isScanning || isCleaning}
            >
              <FolderVectorIcon size={14} /> 自定义目录深度扫盘
            </button>
            <button
              className="btn-glass btn-full"
              onClick={handleEmptyTrash}
              disabled={isScanning || isCleaning}
            >
              <PixelTrashIcon size={15} /> 清空系统回收站 / 废纸篓
            </button>
          </div>
        </aside>

        {/* Right Primary Luminous Frosted Stage */}
        <main className="main-pane">
          {sysStatus && sysStatus.permission_warnings.length > 0 && (
            <div className="sys-warning-strip">
              <PixelShieldAlertIcon size={17} />
              <div className="sys-warning-text">{sysStatus.permission_warnings[0]}</div>
            </div>
          )}

          {/* Hero Pixel Diorama Panel */}
          <div className="hero-panel">
            <PixelFarmerStage
              mood={mood}
              theme={theme}
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
                <PixelMagnifierIcon size={17} />
                <span>{isScanning ? "正在深度扫盘..." : "一键深度扫盘"}</span>
              </button>
              <button
                className="btn-accent btn-lg"
                onClick={openAuditFlow}
                disabled={isScanning || isCleaning || selectedItems.length === 0}
              >
                <PixelBroomIcon size={17} />
                <span>审视并清理 ({formatBytes(selectedTotalBytes)})</span>
              </button>
            </div>
          </div>

          {/* Real-time Scan Progress */}
          {isScanning && scanProgress && (
            <div className="progress-panel">
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${scanProgress.progress_pct}%` }}
                />
              </div>
              <div className="progress-caption">
                <span>
                  已发现 <strong>{scanProgress.found_items}</strong> 项 ·{" "}
                  <strong>{formatBytes(scanProgress.found_bytes)}</strong>
                </span>
                <span>{scanProgress.progress_pct}%</span>
              </div>
            </div>
          )}

          {/* Apple macOS Storage-Style Colored Breakdown Bar */}
          {categories.length > 0 && (
            <StorageBreakdownBar
              categories={categories}
              selectedPaths={selectedPaths}
              onFocusCategory={focusCategory}
            />
          )}

          {/* Filter, Risk Tabs & Accordion Controls */}
          {categories.length > 0 && (
            <div className="results-toolbar">
              <div className="search-input-wrap">
                <SearchIcon size={13} className="search-icon" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索文件名或路径..."
                  className="glass-search-input"
                />
                {searchQuery && (
                  <button
                    className="clear-search-btn"
                    onClick={() => setSearchQuery("")}
                    aria-label="清空搜索"
                  >
                    <WinCloseIcon size={10} />
                  </button>
                )}
              </div>

              <div className="toolbar-actions">
                <div className="segmented-control">
                  {(
                    [
                      ["all", "全部"],
                      ["safe", "安全"],
                      ["caution", "审核"],
                      ["elevated", "系统"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      className={riskFilter === key ? "seg-active" : ""}
                      onClick={() => setRiskFilter(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="segmented-control">
                  <button
                    className={sortBy === "size" ? "seg-active" : ""}
                    onClick={() => setSortBy("size")}
                  >
                    按体积
                  </button>
                  <button
                    className={sortBy === "name" ? "seg-active" : ""}
                    onClick={() => setSortBy("name")}
                  >
                    按名称
                  </button>
                </div>

                <button className="btn-glass btn-xs" onClick={selectSafeOnly}>
                  安全轻扫
                </button>
                <button className="btn-glass btn-xs" onClick={clearSelection}>
                  清空
                </button>
                <button className="btn-glass btn-xs" onClick={() => setAllExpanded(true)}>
                  全展
                </button>
                <button className="btn-glass btn-xs" onClick={() => setAllExpanded(false)}>
                  全收
                </button>
              </div>
            </div>
          )}

          {/* Categories Accordion List OR Pre-Scan Blueprint */}
          <div className="categories-wrap">
            {categories.length === 0 ? (
              <div className="blueprint-stage">
                <div className="blueprint-header">
                  <h3>全盘智能巡检引擎 · 6 大靶向模块</h3>
                  <p>
                    点击右上角「一键深度扫盘」全面体检，或直接点击左侧任一磁盘快速揪出大文件；涉及系统级目录均会在清理前触发权限警报与清单审视。
                  </p>
                </div>
                <div className="blueprint-grid">
                  {PREVIEW_MODULES.map((m) => (
                    <div key={m.title} className="blueprint-card">
                      <div className="bp-top">
                        <span className="bp-title-wrap">
                          <span className="bp-dot" style={{ background: m.color }} />
                          <strong>{m.title}</strong>
                        </span>
                        <span className={`risk-pill risk-${m.risk}`}>{m.tag}</span>
                      </div>
                      <p>{m.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              visibleCategories.map((cat) => (
                <CategoryAccordion
                  key={cat.id}
                  category={cat}
                  grandTotalBytes={grandTotalBytes}
                  isExpanded={!!expandedMap[cat.id]}
                  onToggleExpand={() =>
                    setExpandedMap((prev) => ({ ...prev, [cat.id]: !prev[cat.id] }))
                  }
                  selectedPaths={selectedPaths}
                  onToggleCategory={() => toggleCategory(cat)}
                  onToggleItem={toggleItem}
                  onReveal={(p) => invoke("reveal_in_explorer", { path: p })}
                  searchQuery={searchQuery}
                  sortBy={sortBy}
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* Persistent Apple Music-Inspired Frosted Glass Dock */}
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
