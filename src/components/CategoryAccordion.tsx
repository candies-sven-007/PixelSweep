import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScanCategoryResult,
  ScannedItem,
  formatBytes,
  formatRelativeTime,
  getCategoryColor,
} from "../types";
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
  grandTotalBytes: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  selectedPaths: Record<string, boolean>;
  onToggleCategory: () => void;
  onToggleItem: (path: string) => void;
  onReveal: (path: string) => void;
  searchQuery: string;
  sortBy: "size" | "name";
}

const ROW_HEIGHT = 60;
const VIEWPORT_MAX_H = 310;
const OVERSCAN = 4;

function getExtBadge(item: ScannedItem): string {
  if (item.is_dir) return "DIR";
  const parts = item.name.split(".");
  if (parts.length > 1) {
    const ext = parts[parts.length - 1].toUpperCase();
    if (ext.length <= 5) return ext;
  }
  return "FILE";
}

const CategoryAccordionInner: React.FC<CategoryAccordionProps> = ({
  category,
  grandTotalBytes,
  isExpanded,
  onToggleExpand,
  selectedPaths,
  onToggleCategory,
  onToggleItem,
  onReveal,
  searchQuery,
  sortBy,
}) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  useEffect(() => {
    setScrollTop(0);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [searchQuery, sortBy, isExpanded]);

  const filteredItems = useMemo(() => {
    if (!isExpanded && !searchQuery.trim()) return category.items;
    const q = searchQuery.trim().toLowerCase();
    let list = category.items;
    if (q) {
      list = list.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          it.path.toLowerCase().includes(q) ||
          it.ai_reason.toLowerCase().includes(q)
      );
    }
    if (sortBy === "name") {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [category.items, isExpanded, searchQuery, sortBy]);

  const { checkedCount, checkedBytes } = useMemo(() => {
    let cnt = 0;
    let bytes = 0;
    for (const it of category.items) {
      if (selectedPaths[it.path]) {
        cnt++;
        bytes += it.size_bytes;
      }
    }
    return { checkedCount: cnt, checkedBytes: bytes };
  }, [category.items, selectedPaths]);

  const allChecked = category.items.length > 0 && checkedCount === category.items.length;
  const someChecked = checkedCount > 0 && !allChecked;

  const maxItemSize = useMemo(() => {
    let max = 1;
    for (const it of filteredItems) {
      if (it.size_bytes > max) max = it.size_bytes;
    }
    return max;
  }, [filteredItems]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const accentColor = getCategoryColor(category.domain);
  const sharePct =
    grandTotalBytes > 0 ? Math.min(100, Math.round((category.total_bytes / grandTotalBytes) * 100)) : 0;

  const riskLabel =
    category.risk_level === "safe"
      ? "建议清理"
      : category.risk_level === "protected"
      ? "默认保护"
      : category.risk_level === "elevated"
      ? "系统权限项"
      : "按需审视";

  const totalHeight = filteredItems.length * ROW_HEIGHT;
  const containerH = Math.min(VIEWPORT_MAX_H, Math.max(ROW_HEIGHT, totalHeight));
  const startIdx = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIdx = Math.min(
    filteredItems.length,
    Math.ceil((scrollTop + VIEWPORT_MAX_H) / ROW_HEIGHT) + OVERSCAN
  );
  const visibleSlice = isExpanded ? filteredItems.slice(startIdx, endIdx) : [];

  return (
    <div
      id={`cat-card-${category.id}`}
      className={`acc-card ${isExpanded ? "acc-open" : ""}`}
      style={{ "--cat-accent": accentColor } as React.CSSProperties}
    >
      <div className="acc-header" onClick={onToggleExpand}>
        <span className="acc-color-rail" style={{ background: accentColor }} />

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

        <div className="acc-icon-pill" style={{ background: `${accentColor}1c`, color: accentColor }}>
          <FolderVectorIcon size={16} />
        </div>

        <div className="acc-main">
          <div className="acc-title-line">
            <span className="acc-title">{category.name}</span>
            <span className={`risk-pill risk-${category.risk_level}`}>{riskLabel}</span>
            {category.denied_count > 0 && (
              <span className="denied-pill">{category.denied_count} 项受限</span>
            )}
          </div>
          <p className="acc-desc" title={category.description}>
            {category.subtitle}
          </p>
        </div>

        <div className="acc-right">
          <div className="acc-size-group">
            <strong className="acc-total-size">{formatBytes(category.total_bytes)}</strong>
            <div className="acc-share-row">
              <div className="acc-share-bar">
                <div
                  className="acc-share-fill"
                  style={{ width: `${Math.max(4, sharePct)}%`, background: accentColor }}
                />
              </div>
              <span className="acc-selected-meta">
                {checkedCount}/{category.item_count}
              </span>
            </div>
          </div>
          <span className={`acc-chevron ${isExpanded ? "rotated" : ""}`}>
            <ChevronIcon size={15} />
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="acc-body">
          <div className="acc-subbar">
            <div className="roots-chips">
              <span className="roots-label">识别来源</span>
              {category.root_paths.slice(0, 2).map((rp) => (
                <span key={rp} className="root-chip" title={rp}>
                  {rp}
                </span>
              ))}
              {category.root_paths.length > 2 && (
                <span className="root-chip">+{category.root_paths.length - 2} 处</span>
              )}
            </div>
            <div className="subbar-right">
              {checkedBytes > 0 && (
                <span className="subbar-selected">已选 {formatBytes(checkedBytes)}</span>
              )}
              {category.items.length > 0 && (
                <button
                  type="button"
                  className="btn-ghost-xs"
                  onClick={onToggleCategory}
                >
                  {allChecked ? "取消全选" : "全选本类"}
                </button>
              )}
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="acc-empty">
              {searchQuery.trim()
                ? "当前结果筛选关键词下无匹配项"
                : "该语义分区下暂无发现大体积或可清理文件"}
            </div>
          ) : (
            <div
              ref={scrollRef}
              className="acc-virtual-scroll"
              style={{ height: `${containerH + 12}px` }}
              onScroll={handleScroll}
            >
              <div className="acc-virtual-spacer" style={{ height: `${totalHeight}px` }}>
                {visibleSlice.map((it, localIdx) => {
                  const actualIdx = startIdx + localIdx;
                  const isChecked = !!selectedPaths[it.path];
                  const ratioPct = Math.max(
                    4,
                    Math.min(100, Math.round((it.size_bytes / maxItemSize) * 100))
                  );
                  const badge = getExtBadge(it);
                  const relTime = formatRelativeTime(it.modified_ts);

                  return (
                    <div
                      key={it.path}
                      className={`acc-item-row virtual-row ${isChecked ? "item-checked" : ""}`}
                      style={{
                        transform: `translate3d(0, ${actualIdx * ROW_HEIGHT}px, 0)`,
                        height: `${ROW_HEIGHT - 4}px`,
                      }}
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
                          {relTime && <span className="time-pill">{relTime}</span>}
                          <span className={`rec-pill rec-${it.recommendation}`}>
                            {it.recommendation === "recommend"
                              ? "建议清理"
                              : it.recommendation === "protect"
                              ? "建议保留"
                              : "按需审视"}
                          </span>
                          {it.requires_privilege && (
                            <span className="priv-badge">需系统权限</span>
                          )}
                        </div>
                        <div className="item-sub-meta">
                          <span className="item-ai-reason">{it.ai_reason}</span>
                          <span className="item-path-sep">·</span>
                          <span className="item-path-text" title={it.path}>
                            {it.path}
                          </span>
                        </div>
                      </div>

                      <div className="item-size-col">
                        <span className="item-size-val">{formatBytes(it.size_bytes)}</span>
                        <div className="item-mini-bar">
                          <div
                            className="item-mini-fill"
                            style={{ width: `${ratioPct}%`, background: accentColor }}
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn-icon-ghost"
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const CategoryAccordion = memo(CategoryAccordionInner);
