import React, { useMemo, useState } from "react";
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
  const [visibleLimit, setVisibleLimit] = useState(40);

  const filteredItems = useMemo(() => {
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

  const accentColor = getCategoryColor(category.domain);
  const sharePct =
    grandTotalBytes > 0 ? Math.min(100, Math.round((category.total_bytes / grandTotalBytes) * 100)) : 0;
  const shownItems = filteredItems.slice(0, visibleLimit);

  const riskLabel =
    category.risk_level === "safe"
      ? "建议清理"
      : category.risk_level === "protected"
      ? "默认保护"
      : category.risk_level === "elevated"
      ? "系统权限项"
      : "按需审视";

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

        <div className="acc-icon-pill" style={{ background: `${accentColor}1f`, color: accentColor }}>
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
            {category.subtitle} · {category.description}
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
                {checkedItems.length}/{category.item_count}
              </span>
            </div>
          </div>
          <span className={`acc-chevron ${isExpanded ? "rotated" : ""}`}>
            <ChevronIcon size={15} />
          </span>
        </div>
      </div>

      <div className="acc-collapse-outer">
        <div className="acc-collapse-inner">
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
                    className="btn-inline-toggle"
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
                  ? "当前搜索关键词下无匹配项"
                  : "该语义分区下暂无发现大体积或可清理文件"}
              </div>
            ) : (
              <div className="acc-items-scroll">
                {shownItems.map((it) => {
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
                        <div className="item-ai-reason">{it.ai_reason}</div>
                        <div className="item-path-text" title={it.path}>
                          {it.path}
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
