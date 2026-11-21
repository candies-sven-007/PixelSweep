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
  SmartSummary,
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

const SMART_BLUEPRINT = [
  {
    title: "无用废物与冗余残留",
    tag: "建议清理",
    risk: "safe",
    color: "#10b981",
    desc: "自动侦测系统临时碎片、残留安装包、未完成下载、重复副本与浏览器网页缓存。",
  },
  {
    title: "软件与开发构建缓存",
    tag: "按需审视",
    risk: "caution",
    color: "#6366f1",
    desc: "识别显卡着色器、过期 node_modules/target 依赖及 npm/pip/Cargo/Xcode 缓存。",
  },
  {
    title: "娱乐、影音与游戏区",
    tag: "按需审视",
    risk: "caution",
    color: "#ec4899",
    desc: "智能归类高清电影番剧、游戏资源包、本地音乐与电子书，看完的大视频可按需瘦身。",
  },
  {
    title: "生活、照片与个人回忆",
    tag: "默认保护",
    risk: "protected",
    color: "#f97316",
    desc: "识别相册原图、生活录像与微信/QQ 个人文件，自动上锁防误删，清晰呈现空间占比。",
  },
  {
    title: "工作、学习与创作项目",
    tag: "默认保护",
    risk: "protected",
    color: "#0ea5e9",
    desc: "自动归类办公文档、课件资料、设计剪辑工程与代码目录，盘点空间的同时严防误删。",
  },
  {
    title: "系统权限区与更新缓存",
    tag: "系统权限项",
    risk: "elevated",
    color: "#f59e0b",
    desc: "覆盖 Windows\\Temp、更新缓存与 macOS /Library 系统区，清理前强制报警审核。",
  },
];

const LIFETIME_KEY = "pixelsweep_lifetime_freed_bytes";

export const App: React.FC = () => {
  const [sysStatus, setSysStatus] = useState<SystemStatus | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [isMaximized, setIsMaximized] = useState(false);
  const [mood, setMood] = useState<CharacterMood>("idle");
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  // Scan & smart filter state
  const [isScanning, setIsScanning] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgressPayload | null>(null);
  const [cleanProgress, setCleanProgress] = useState<CleanProgressPayload | null>(null);
  const [categories, setCategories] = useState<ScanCategoryResult[]>([]);
  const [smartSummary, setSmartSummary] = useState<SmartSummary | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});
  const [cleanMode, setCleanMode] = useState<"recycle" | "permanent">("recycle");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"size" | "name">("size");
  const [domainFilter, setDomainFilter] = useState<string>("all");

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
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 4400);
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
      // Built-in cozy synth takes over when Music folder is empty
    }
  }, []);

  useEffect(() => {
    refreshSystem();
    loadMusic();

    const win = getCurrentWindow();
    const syncMax = () => {
      win.isMaximized().then(setIsMaximized).catch(() => {});
    };
    syncMax();

    const unlistenResize = win.onResized(syncMax);
    const unlistenScan = listen<ScanProgressPayload>("scan-progress", (e) => {
      setScanProgress(e.payload);
    });
    const unlistenClean = listen<CleanProgressPayload>("clean-progress", (e) => {
      setCleanProgress(e.payload);
    });

    return () => {
      unlistenResize.then((f) => f()).catch(() => {});
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

  const applyScanResult = (res: FullScanResult) => {
    setCategories(res.categories);
    setSmartSummary(res.summary);
    setDomainFilter("all");

    // Smart auto-select ONLY explicitly recommended waste/junk items
    const nextSelected: Record<string, boolean> = {};
    for (const cat of res.categories) {
      for (const it of cat.items) {
        if (it.recommendation === "recommend" && !it.requires_privilege) {
          nextSelected[it.path] = true;
        }
      }
    }
    setSelectedPaths(nextSelected);

    const firstNonEmpty = res.categories.find((c) => c.items.length > 0) ?? res.categories[0];
    if (firstNonEmpty) {
      setExpandedMap({ [firstNonEmpty.id]: true });
    }
  };

  const handleFullScan = async () => {
    if (isScanning || isCleaning) return;
    setIsScanning(true);
    setLastReport(null);
    setMood("scanning");
    try {
      const res = await invoke<FullScanResult>("start_full_scan");
      applyScanResult(res);
      setMood("idle");
      showToast(
        `全盘智能盘点完成：识别 ${res.total_items} 项（共 ${formatBytes(
          res.total_bytes
        )}），建议清理 ${formatBytes(res.summary.reclaimable_bytes)}`
      );
    } catch (e) {
      setMood("idle");
      showToast(`扫描异常: ${String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const scanSpecificPath = async (targetPath: string, minMb = 10) => {
    if (isScanning || isCleaning) return;
    setIsScanning(true);
    setLastReport(null);
    setMood("scanning");
    try {
      const res = await invoke<FullScanResult>("scan_custom_folder", {
        targetDir: targetPath,
        minSizeMb: minMb,
      });
      applyScanResult(res);
      setMood("idle");
      showToast(
        `已智能剖析 ${targetPath}：共归类 ${res.total_items} 项（${formatBytes(
          res.total_bytes
        )}）`
      );
    } catch (e) {
      setMood("idle");
      showToast(`剖析失败: ${String(e)}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleCustomFolderScan = async () => {
    if (isScanning || isCleaning) return;
    const picked = await open({
      directory: true,
      multiple: false,
      title: "选择要智能语义剖析的磁盘或文件夹",
    });
    if (!picked || typeof picked !== "string") return;
    await scanSpecificPath(picked, 5);
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
    if (domainFilter === "all") return categories;
    return categories.filter((c) => c.domain === domainFilter);
  }, [categories, domainFilter]);

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

  const selectRecommendedOnly = () => {
    const next: Record<string, boolean> = {};
    for (const cat of categories) {
      for (const it of cat.items) {
        if (it.recommendation === "recommend" && !it.requires_privilege) {
          next[it.path] = true;
        }
      }
    }
    setSelectedPaths(next);
    showToast("已智能勾选所有「建议清理」废物与残留，个人生活与工作资料已自动跳过");
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
    setDomainFilter("all");
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
  const useFloatingFrame = sysStatus?.window_chrome === "floating" && !isMaximized;

  const stageTitle = isScanning
    ? scanProgress?.stage || "正在智能语义剖析磁盘..."
    : isCleaning
    ? `正在清扫 (${cleanProgress?.processed ?? 0}/${cleanProgress?.total ?? 0})`
    : lastReport
    ? `本次已释放 ${formatBytes(lastReport.freed_bytes)}`
    : categories.length > 0
    ? `已选 ${selectedItems.length} 项 · 预计释放 ${formatBytes(selectedTotalBytes)}`
    : "智能盘点全盘，惬意清扫空间";

  const stageSub = isScanning
    ? scanProgress?.current_path || "放大镜巡检并区分废物、娱乐、生活与工作区..."
    : isCleaning
    ? cleanProgress?.current_path || "小农夫和森林芽灵正在合力清扫垃圾..."
    : lastReport
    ? `模式：${lastReport.mode === "permanent" ? "直接彻底删除" : "移入系统回收站"} · 成功 ${
        lastReport.deleted_count
      } 项 · 跳过 ${lastReport.skipped_count} 项`
    : "自动将文件划分为无用废物、缓存、娱乐、生活回忆与工作项目；个人资产与系统目录默认受保护。";

  const win = getCurrentWindow();

  return (
    <div className={`window-outer ${useFloatingFrame ? "is-floating" : "is-docked"}`}>
      <div className={`app-shell theme-${theme} ${useFloatingFrame ? "rounded-chassis" : ""}`}>
        {/* Ambient Liquid Glass Orbs + Subtle Sandblasted Grain */}
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
            <span className="brand-badge">v1.3 智能版</span>
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
                <button className="win-btn" onClick={() => win.toggleMaximize()} title="最大化 / 还原">
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
                <span className="section-label">磁盘概览 · 点盘智能剖析</span>
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
                    <div
                      key={d.mount_point}
                      role="button"
                      tabIndex={0}
                      className={`disk-card clickable-disk ${isScanning || isCleaning ? "disk-disabled" : ""}`}
                      onClick={() => {
                        if (!isScanning && !isCleaning) scanSpecificPath(d.mount_point, 15);
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === "Enter" || e.key === " ") && !isScanning && !isCleaning) {
                          scanSpecificPath(d.mount_point, 15);
                        }
                      }}
                      title={`点击对 ${d.mount_point} 进行智能语义分区剖析`}
                    >
                      <div className="disk-top">
                        <span className="disk-mount">
                          <HardDriveIcon size={13} />
                          <strong>{d.mount_point}</strong>
                        </span>
                        <span className="disk-top-right">
                          <span className="disk-scan-hint">智能剖析</span>
                          <span className={`disk-pct ${pct > 85 ? "pct-high" : ""}`}>{pct}%</span>
                        </span>
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
                <FolderVectorIcon size={14} /> 指定目录智能剖析
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
                  <span>{isScanning ? "正在智能盘点..." : "一键全盘智能盘点"}</span>
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
                    已归类 <strong>{scanProgress.found_items}</strong> 项 ·{" "}
                    <strong>{formatBytes(scanProgress.found_bytes)}</strong>
                  </span>
                  <span>{scanProgress.progress_pct}%</span>
                </div>
              </div>
            )}

            {/* Apple macOS Storage-Style Smart Semantic Breakdown Bar */}
            {categories.length > 0 && (
              <StorageBreakdownBar
                categories={categories}
                summary={smartSummary}
                selectedPaths={selectedPaths}
                onFocusCategory={focusCategory}
                onSmartSelectRecommended={selectRecommendedOnly}
              />
            )}

            {/* Smart Domain Tabs & Search/Sort Toolbar */}
            {categories.length > 0 && (
              <div className="results-toolbar">
                <div className="search-input-wrap">
                  <SearchIcon size={13} className="search-icon" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜文件名、路径或智能诊断..."
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
                        ["junk", "废物"],
                        ["dev_cache", "缓存"],
                        ["entertainment", "娱乐"],
                        ["life", "生活"],
                        ["work", "工作"],
                        ["system_elevated", "系统"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        className={domainFilter === key ? "seg-active" : ""}
                        onClick={() => setDomainFilter(key)}
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
                      体积
                    </button>
                    <button
                      className={sortBy === "name" ? "seg-active" : ""}
                      onClick={() => setSortBy("name")}
                    >
                      名称
                    </button>
                  </div>

                  <button className="btn-glass btn-xs" onClick={clearSelection}>
                    清空勾选
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

            {/* Smart Categories List OR Pre-Scan Blueprint */}
            <div className="categories-wrap">
              {categories.length === 0 ? (
                <div className="blueprint-stage">
                  <div className="blueprint-header">
                    <h3>智能文件语义剖析引擎 · 6 大分区维度</h3>
                    <p>
                      点击「一键全盘智能盘点」全面诊断，或直接点击左侧任意盘符（C:\ / D:\ / F:\ / G:\）按生活、娱乐、工作与无用废物智能分类；个人高价值文件默认自动保护。
                    </p>
                  </div>
                  <div className="blueprint-grid">
                    {SMART_BLUEPRINT.map((m) => (
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
    </div>
  );
};

export default App;
