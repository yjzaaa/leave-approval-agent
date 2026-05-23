import React, { useEffect } from 'react';
import type { ConfirmRequest } from '../client-types';

interface Props {
  confirmRequest: ConfirmRequest;
  onConfirm: (approved: boolean) => void;
}

export const ConfirmCard: React.FC<Props> = ({ confirmRequest, onConfirm }) => {
  const { tool, label, form, fieldLabels } = confirmRequest;
  const entries = Object.entries(fieldLabels).filter(([key]) => form[key] !== undefined);

  // 阻止背景滚动
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  return (
    <div className="confirm-overlay">
      <div className="confirm-modal">
        <div className="confirm-modal-header">
          <span className="confirm-modal-icon">🔒</span>
          <div>
            <div className="confirm-modal-title">{label}</div>
            <div className="confirm-modal-subtitle">
              {tool === 'submit_form' ? '请核对以下信息后确认提交' : '请确认发起审批流程'}
            </div>
          </div>
        </div>

        <div className="confirm-modal-body">
          <table className="form-table">
            <tbody>
              {entries.map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td><strong>{String(form[key] ?? '')}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="confirm-modal-actions">
          <button className="btn btn-reject-modal" onClick={() => onConfirm(false)}>
            ❌ 拒绝
          </button>
          <button className="btn btn-approve-modal" onClick={() => onConfirm(true)}>
            ✅ {tool === 'submit_form' ? '确认提交' : '确认发起'}
          </button>
        </div>
      </div>
    </div>
  );
};
