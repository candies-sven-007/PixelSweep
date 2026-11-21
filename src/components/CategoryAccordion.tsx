import React, { useMemo, useState } from "react";
import { ScanCategoryResult, ScannedItem, formatBytes } from "../types";
import {
  CheckIcon,
  ChevronIcon,
  ExternalLocateIcon,
  FileVectorIcon,
  FolderVectorIcon,
  MinusIcon,
} from "./UiIcons";

interface CategoryAccordionProps {
  category: ScanCategoryResult;
  isExpanded: boolean;
  onToggleExpand: () => void;
  selectedPaths: Record<string, boolean>;
  onToggleCategory: () => void;
  onToggleItem: (path: string) => void;
  onReveal: (path: string) => void;
  searchQuery: string;
  sortBy: "size" | "name";
}

function getExtBadge(item: ScannedItem): string {
  if (item.is_dir) return "DIR";
  const parts = item.name.split(".");
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toUpperCase();
    if (ext.length <= 5) return ext;
  }
  return "FILE";
}

export const CategoryAccordion: React.FC<CategoryAccordionProps> = ({
  category,
  isExpanded,
  onToggleExpand,
  selectedPaths,
  onToggleCategory,
  onToggleItem,
  onReveal,
  searchQuery,
  sortBy,
}) => {
  const [visibleLimit, setVisibleLimit] = useState(40);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let list = category.items;
    if (q) {
      list = list.filter(
        (it) => it.name.toLowerCase().includes(q) || it.path.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    if (sortBy === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else {
      sorted.sort((a, b) => b.size_bytes - a.size_bytes);
    }
    return sorted;
  }, [category.items, searchQuery, sortBy]);

  const checkedItems = useMemo(
    () => category.items.filter((it) => selectedPaths[it.path]),
    [category.items, selectedPaths]
  );

  const checkedBytes = useMemo(
    () => checkedItems.reduce((acc, it) => acc + it.size_bytes, 0),
    [checkedItems]
  );

  const allChecked = category.items.length > 0 && checkedItems.length === category.items.length;
  const someChecked = checkedItems.length > 0 && !allChecked;
  const maxItemSize = useMemo(
    () => Math.max(1, ...filteredItems.map((it) => it.size_bytes)),
    [filteredItems]
  );

  const shownItems = filteredItems.slice(0, visibleLimit);

  return (
    <div className={`acc-card ${isExpanded ? "acc-open" : ""} acc-risk-${category.risk_level}`}>
      {/* Header Row */}
      <div className="acc-header" onClick={onToggleExpand}>
        <button
          type="button"
          className={`apple-check ${allChecked ? "checked" : someChecked ? "indeterminate" : ""}`}
          disabled={category.items.length === 0}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCategory();
          }}
          aria-label={`选择分类 ${category.name}`}
        >
          {allChecked && <CheckIcon size={11} />}
          {someChecked && <MinusIcon size={11} />}
        </button>

        <div className={`acc-icon-pill risk-bg-${category.risk_level}`}>
          <FolderVectorIcon size={16} />
        </div>

        <div className="acc-main">
          <div className="acc-title-line">
            <span className="acc-title">{category.name}</span>
            <span className={`risk-pill risk-${category.risk_level}`}>
              {category.risk_level === "safe"
                ? "安全缓存"
                : category.risk_level === "elevated"
                ? "系统权限项"
                : "需人工审核"}
            </span>
            {category.denied_count > 0 && (
              <span className="denied-pill">{category.denied_count} 项受限</span>
            )}
          </div>
          <p className="acc-desc">{category.description}</p>
        </div>

        <div className="acc-right">
          <div className="acc-size-group">
            <strong className="acc-total-size">{formatBytes(category.total_bytes)}</strong>
            <span className="acc-selected-meta">
              已选 {checkedItems.length}/{category.item_count}
              {checkedBytes > 0 ? ` · ${formatBytes(checkedBytes)}` : ""}
            </span>
          </div>
          <span className={`acc-chevron ${isExpanded ? "rotated" : ""}`}>
            <ChevronIcon size={16} />
          </span>
        </div>
      </div>

      {/* Smooth Animated Collapsible Body (CSS grid-template-rows) */}
      <div className="acc-collapse-outer">
        <div className="acc-collapse-inner">
          <div className="acc-body">
            {category.root_paths.length > 0 && (
              <div className="acc-roots-strip">
                <span className="roots-label">扫描路径</span>
                <div className="roots-chips">
                  {category.root_paths.slice(0, 3).map((rp) => (
                    <span key={rp} className="root-chip" title={rp}>
                      {rp}
                    </span>
                  ))}
                  {category.root_paths.length > 3 && (
                    <span className="root-chip">+{category.root_paths.length - 3} 处</span>
                  )}
                </div>
              </div>
            )}

            {filteredItems.length === 0 ? (
              <div className="acc-empty">
                {searchQuery.trim()
                  ? "当前搜索关键词下无匹配项"
                  : "该分类下非常干净，暂未发现可清理内容"}
              </div>
            ) : (
              <div className="acc-items-scroll">
                {shownItems.map((it) => {
                  const isChecked = !!selectedPaths[it.path];
                  const ratioPct = Math.max(
                    3,
                    Math.min(100, Math.round((it.size_bytes / maxItemSize) * 100))
                  );
                  const badge = getExtBadge(it);

                  return (
                    <div
                      key={it.path}
                      className={`acc-item-row ${isChecked ? "item-checked" : ""}`}
                      onClick={() => onToggleItem(it.path)}
                    >
                      <button
                        type="button"
                        className={`apple-check sm ${isChecked ? "checked" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleItem(it.path);
                        }}
                        aria-label={`选择 ${it.name}`}
                      >
                        {isChecked && <CheckIcon size={10} />}
                      </button>

                      <div className={`item-type-icon ${it.is_dir ? "type-dir" : "type-file"}`}>
                        {it.is_dir ? <FolderVectorIcon size={14} /> : <FileVectorIcon size={14} />}
                      </div>

                      <div className="item-text-col">
                        <div className="item-name-line">
                          <span className="item-name-text" title={it.name}>
                            {it.name}
                          </span>
                          <span className="ext-badge">{badge}</span>
                          {it.requires_privilege && (
                            <span className="priv-badge">需系统权限</span>
                          )}
                        </div>
                        <div className="item-path-text" title={it.path}>
                          {it.path}
                        </div>
                      </div>

                      <div className="item-size-col">
                        <span className="item-size-val">{formatBytes(it.size_bytes)}</span>
                        <div className="item-mini-bar">
                          <div className="item-mini-fill" style={{ width: `${ratioPct}%` }} />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="item-locate-btn"
                        title="在文件夹中定位查看"
                        onClick={(e) => {
                          e.stopPropagation();
                          onReveal(it.path);
                        }}
                      >
                        <ExternalLocateIcon size={13} />
                      </button>
                    </div>
                  );
                })}

                {filteredItems.length > visibleLimit && (
                  <button
                    type="button"
                    className="load-more-btn"
                    onClick={() => setVisibleLimit((v) => v + 60)}
                  >
                    展开剩余 {filteredItems.length - visibleLimit} 项...
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
