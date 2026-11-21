import React, { useMemo, useState } from "react";
import { ScanCategoryResult, formatBytes, getCategoryColor } from "../types";

interface StorageBreakdownBarProps {
  categories: ScanCategoryResult[];
  selectedPaths: Record<string, boolean>;
  onFocusCategory: (catId: string) => void;
}

export const StorageBreakdownBar: React.FC<StorageBreakdownBarProps> = ({
  categories,
  selectedPaths,
  onFocusCategory,
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
          <span className="storage-title">扫描空间分布</span>
          <span className="storage-sub">
            {hoveredCat
              ? `${hoveredCat.name} · ${formatBytes(hoveredCat.total_bytes)} (${Math.max(
                  1,
                  Math.round((hoveredCat.total_bytes / totalBytes) * 100)
                )}%)`
              : `共发现 ${formatBytes(totalBytes)}，点击色块可快速定位展开`}
          </span>
        </div>
        <div className="storage-head-right">
          待释放 <strong>{formatBytes(selectedBytes)}</strong>
        </div>
      </div>

      <div className="apple-segment-track">
        {nonZeroCats.map((cat) => {
          const pct = (cat.total_bytes / totalBytes) * 100;
          const color = getCategoryColor(cat.id, cat.risk_level);
          const isHovered = hoveredId === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              className={`apple-segment-slice ${isHovered ? "slice-active" : ""}`}
              style={{
                width: `${Math.max(2.5, pct)}%`,
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
          const color = getCategoryColor(cat.id, cat.risk_level);
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
              <span className="legend-name">{cat.name.split(" ")[0]}</span>
              <span className="legend-size">{formatBytes(cat.total_bytes)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
