/**
 * ConfirmCard — 确认弹窗 v3.0
 *
 * 完全与业务解耦：
 *   - 不再判断 tool === 'submit_form' 来决定文案
 *   - 标题和副标题由插件通过 SSE confirm_required 事件动态提供
 *   - 字段表格由 fieldLabels + form 动态渲染
 *
 * 特性：
 *   1. 模态遮罩 + 毛玻璃模糊背景
 *   2. 焦点陷阱（Tab 在弹窗内循环）
 *   3. ESC 关闭 / 遮罩点击关闭 / 拒绝按钮关闭
 *   4. 入场/退场动画
 */
import React, { useEffect, useRef } from 'react';
import type { ConfirmRequest } from '../../types';

interface Props {
  confirmRequest: ConfirmRequest;
  onConfirm: (approved: boolean) => void;
}

export const ConfirmCard: React.FC<Props> = ({ confirmRequest, onConfirm }) => {
  const { label, form, fieldLabels } = confirmRequest;
  // 只显示有值的字段
  const entries = Object.entries(fieldLabels).filter(([key]) => form[key] !== undefined);
  const overlayRef = useRef<HTMLDivElement>(null);
  const approveBtnRef = useRef<HTMLButtonElement>(null);

  // ── 副作用：锁背景 + 焦点管理 + ESC 关闭 ──
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    approveBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC 关闭
      if (e.key === 'Escape') {
        onConfirm(false);
        return;
      }
      // 焦点陷阱
      if (e.key === 'Tab' && overlayRef.current) {
        const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onConfirm]);

  /** 点击遮罩关闭 */
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onConfirm(false);
    }
  };

  return (
    <div
      className="confirm-overlay"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div className="confirm-modal">
        {/* Header — 标题由插件提供 */}
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon" aria-hidden="true">🔒</div>
          <div>
            <div className="confirm-modal-title" id="confirm-modal-title">
              {label}
            </div>
            <div className="confirm-modal-subtitle" id="confirm-modal-desc">
              请仔细核对以下信息，确认无误后提交
            </div>
          </div>
        </div>

        {/* Body — 动态表单信息表格 */}
        <div className="confirm-modal-body">
          <table className="form-table" role="table" aria-label="申请信息摘要">
            <tbody>
              {entries.map(([key, fieldLabel]) => (
                <tr key={key}>
                  <td>{fieldLabel}</td>
                  <td><strong>{String(form[key] ?? '—')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Actions — 拒绝 & 确认按钮 */}
        <div className="confirm-modal-actions">
          <button
            className="btn-modal btn-modal-reject"
            onClick={() => onConfirm(false)}
          >
            ✕ 拒绝
          </button>
          <button
            className="btn-modal btn-modal-approve"
            onClick={() => onConfirm(true)}
            ref={approveBtnRef}
          >
            ✓ 确认提交
          </button>
        </div>
      </div>
    </div>
  );
};
