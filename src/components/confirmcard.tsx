import React, { useEffect, useRef } from 'react';
import type { ConfirmRequest } from '../client-types';

interface Props {
  confirmRequest: ConfirmRequest;
  onConfirm: (approved: boolean) => void;
}

export const ConfirmCard: React.FC<Props> = ({ confirmRequest, onConfirm }) => {
  const { tool, label, form, fieldLabels } = confirmRequest;
  const entries = Object.entries(fieldLabels).filter(([key]) => form[key] !== undefined);
  const overlayRef = useRef<HTMLDivElement>(null);
  const approveBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    approveBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onConfirm(false);
      }
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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onConfirm(false);
    }
  };

  const isSubmit = tool === 'submit_form';

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
        <div className="confirm-modal-header">
          <div className="confirm-modal-icon" aria-hidden="true">🔒</div>
          <div>
            <div className="confirm-modal-title" id="confirm-modal-title">
              {label}
            </div>
            <div className="confirm-modal-subtitle" id="confirm-modal-desc">
              {isSubmit
                ? '请仔细核对以下信息，确认无误后提交'
                : '请确认发起审批流程'}
            </div>
          </div>
        </div>

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
            ✓ {isSubmit ? '确认提交' : '确认发起'}
          </button>
        </div>
      </div>
    </div>
  );
};
