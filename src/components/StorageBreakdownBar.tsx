import React, { useMemo, useState } from "react";
import {
  ScanCategoryResult,
  SmartSummary,
  formatBytes,
  getCategoryColor,
  getDomainShortLabel,
} from "../types";

interface StorageBreakdownBarProps {
  categories: ScanCategoryResult[];
  summary: SmartSummary | null;
  selectedPaths: Record<string, boolean>;
  onFocusCategory: (catId: string) => void;
  onSmartSelectRecommended: () => void;
}

export const StorageBreakdownBar: React.FC<StorageBreakdownBarProps> = ({
  categories,
  summary,
  selectedPaths,
  onFocusCategory,
  onSmartSelectRecommended,
}) => {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const nonZeroCats = useMemo(
    () => categories.filter((c) => c.total_bytes > 0),
    [categories]
  );

  const totalBytes = useMemo(
    () => nonZeroCats.reduce((acc, c) => acc + c.total_bytes, 0),
    [nonZeroCats]
  );

  const selectedBytes = useMemo(() => {
    let sum = 0;
    for (const c of categories) {
      for (const it of c.items) {
        if (selectedPaths[it.path]) sum += it.size_bytes;
      }
    }
    return sum;
  }, [categories, selectedPaths]);

  if (nonZeroCats.length === 0 || totalBytes === 0) return null;

  const hoveredCat = nonZeroCats.find((c) => c.id === hoveredId) ?? null;

  return (
    <div className="storage-bar-card">
      <div className="storage-bar-head">
        <div className="storage-head-left">
          {summary && (
            <span
              className={`score-badge ${
                summary.health_score >= 85
                  ? "score-good"
                  : summary.health_score >= 65
                  ? "score-mid"
                  : "score-low"
              }`}
            >
              整洁度 {summary.health_score}
            </span>
          )}
          <span className="storage-title">
            {summary?.scope_label || "智能语义空间分布"}
          </span>
          <span className="storage-sub" title={summary?.headline || ""}>
            {hoveredCat
              ? `${hoveredCat.name} · ${formatBytes(hoveredCat.total_bytes)} (${Math.max(
                  1,
                  Math.round((hoveredCat.total_bytes / totalBytes) * 100)
                )}%)`
              : summary?.headline || `共分析 ${formatBytes(totalBytes)}`}
          </span>
        </div>

        <div className="storage-head-right">
          {summary && summary.reclaimable_bytes > 0 && (
            <button
              type="button"
              className="smart-rec-btn"
              onClick={onSmartSelectRecommended}
              title="自动仅勾选无用废物、旧安装包与过期缓存，绝不触碰生活/工作资料"
            >
              智能勾选建议清理 ({formatBytes(summary.reclaimable_bytes)})
            </button>
          )}
          <span className="pending-size-pill">
            已选 <strong>{formatBytes(selectedBytes)}</strong>
          </span>
        </div>
      </div>

      <div className="apple-segment-track">
        {nonZeroCats.map((cat) => {
          const pct = (cat.total_bytes / totalBytes) * 100;
          const color = getCategoryColor(cat.domain);
          const isHovered = hoveredId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              className={`apple-segment-slice ${isHovered ? "slice-active" : ""}`}
              style={{
                width: `${Math.max(3, pct)}%`,
                background: color,
              }}
              onMouseEnter={() => setHoveredId(cat.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onFocusCategory(cat.id)}
              title={`${cat.name}: ${formatBytes(cat.total_bytes)}`}
            />
          );
        })}
      </div>

      <div className="storage-legend">
        {nonZeroCats.map((cat) => {
          const color = getCategoryColor(cat.domain);
          return (
            <button
              key={cat.id}
              type="button"
              className={`legend-chip ${hoveredId === cat.id ? "legend-active" : ""}`}
              onMouseEnter={() => setHoveredId(cat.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onFocusCategory(cat.id)}
            >
              <span className="legend-dot" style={{ background: color }} />
              <span className="legend-name">{getDomainShortLabel(cat.domain)}</span>
              <span className="legend-size">{formatBytes(cat.total_bytes)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
