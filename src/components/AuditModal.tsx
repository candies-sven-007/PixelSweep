import React, { useMemo, useState } from "react";
import { ScannedItem, formatBytes } from "../types";
import { PixelShieldAlertIcon } from "./PixelIcons";
import { CheckIcon, WinCloseIcon } from "./UiIcons";

interface AuditModalProps {
  items: ScannedItem[];
  mode: "recycle" | "permanent";
  onModeChange: (m: "recycle" | "permanent") => void;
  onCancel: () => void;
  onConfirm: (approvedPaths: string[], mode: "recycle" | "permanent") => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({
  items,
  mode,
  onModeChange,
  onCancel,
  onConfirm,
}) => {
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    for (const it of items) m[it.path] = true;
    return m;
  });
  const [hasReviewed, setHasReviewed] = useState(false);
  const [confirmPermanent, setConfirmPermanent] = useState(false);

  const approvedItems = useMemo(
    () => items.filter((it) => checkedMap[it.path]),
    [items, checkedMap]
  );

  const elevatedItems = useMemo(
    () => approvedItems.filter((it) => it.requires_privilege || it.risk_level === "elevated"),
    [approvedItems]
  );

  const totalBytes = useMemo(
    () => approvedItems.reduce((acc, it) => acc + it.size_bytes, 0),
    [approvedItems]
  );

  const toggleItem = (path: string) => {
    setCheckedMap((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const canProceed =
    approvedItems.length > 0 &&
    hasReviewed &&
    (mode === "recycle" || confirmPermanent);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="glass-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-row">
            <div className="modal-shield-badge">
              <PixelShieldAlertIcon size={22} />
            </div>
            <div>
              <h3>清理前安全审视与权限确认</h3>
              <p className="muted-text">
                请逐项核对待清理目标；涉及系统级目录或永久删除时需手动确认授权。
              </p>
            </div>
          </div>
          <button className="icon-close-btn" onClick={onCancel} aria-label="关闭">
            <WinCloseIcon size={12} />
          </button>
        </div>

        {(elevatedItems.length > 0 || mode === "permanent") && (
          <div className={`alarm-banner ${mode === "permanent" ? "alarm-danger" : "alarm-warn"}`}>
            <strong>
              {elevatedItems.length > 0
                ? `系统权限警报：清单包含 ${elevatedItems.length} 项系统级路径`
                : "不可逆操作警报：当前已选择【直接彻底删除】"}
            </strong>
            <p>
              {elevatedItems.length > 0
                ? "部分目标位于系统目录（如 Windows\\Temp、更新缓存或 /Library 系统区），清理需要管理员或完全磁盘访问权限。请务必审视下方清单后再放行。"
                : "直接彻底删除将绕过系统回收站/废纸篓，文件删除后无法恢复。若不确定，建议切换回「移入回收站」。"}
            </p>
          </div>
        )}

        <div className="mode-selector">
          <button
            type="button"
            className={`mode-pill ${mode === "recycle" ? "active-safe" : ""}`}
            onClick={() => onModeChange("recycle")}
          >
            <strong>模式一：移入系统回收站 / 废纸篓（推荐）</strong>
            <span>安全可恢复，确认无异常后再一键清空回收站</span>
          </button>
          <button
            type="button"
            className={`mode-pill ${mode === "permanent" ? "active-danger" : ""}`}
            onClick={() => onModeChange("permanent")}
          >
            <strong>模式二：直接彻底永久删除</strong>
            <span>立即释放磁盘空间，跳过回收站且不可找回</span>
          </button>
        </div>

        <div className="audit-list-header">
          <span>
            待清理清单：<strong>{approvedItems.length}</strong> 项，预计释放{" "}
            <strong>{formatBytes(totalBytes)}</strong>
          </span>
          <span className="muted-text">可随时点击取消勾选不需要删除的项目</span>
        </div>

        <div className="audit-list">
          {items.map((it) => {
            const isChecked = !!checkedMap[it.path];
            return (
              <div
                key={it.path}
                className={`audit-row ${isChecked ? "audit-checked" : ""}`}
                onClick={() => toggleItem(it.path)}
              >
                <span className={`apple-check sm ${isChecked ? "checked" : ""}`}>
                  {isChecked && <CheckIcon size={10} />}
                </span>
                <div className="audit-row-main">
                  <div className="audit-row-top">
                    <span className="audit-name">{it.name}</span>
                    {(it.requires_privilege || it.risk_level === "elevated") && (
                      <span className="priv-badge">需系统权限</span>
                    )}
                  </div>
                  <span className="audit-path" title={it.path}>
                    {it.path}
                  </span>
                </div>
                <span className="audit-size">{formatBytes(it.size_bytes)}</span>
              </div>
            );
          })}
        </div>

        <div className="audit-confirm-checks">
          <div
            className="confirm-check"
            onClick={() => setHasReviewed((v) => !v)}
          >
            <span className={`apple-check sm ${hasReviewed ? "checked" : ""}`}>
              {hasReviewed && <CheckIcon size={10} />}
            </span>
            <span>我已审视以上文件清单与权限报警，同意对已勾选项目执行清理操作。</span>
          </div>

          {mode === "permanent" && (
            <div
              className="confirm-check danger-check"
              onClick={() => setConfirmPermanent((v) => !v)}
            >
              <span className={`apple-check sm danger-box ${confirmPermanent ? "checked" : ""}`}>
                {confirmPermanent && <CheckIcon size={10} />}
              </span>
              <span>我明确知晓【直接彻底删除】无法从回收站恢复，确认永久销毁所选文件。</span>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn-glass" onClick={onCancel}>
            取消返回
          </button>
          <button
            type="button"
            className={mode === "permanent" ? "btn-danger" : "btn-primary"}
            disabled={!canProceed}
            onClick={() =>
              onConfirm(
                approvedItems.map((x) => x.path),
                mode
              )
            }
          >
            {mode === "permanent"
              ? `授权并彻底删除 (${formatBytes(totalBytes)})`
              : `授权并移入回收站 (${formatBytes(totalBytes)})`}
          </button>
        </div>
      </div>
    </div>
  );
};
