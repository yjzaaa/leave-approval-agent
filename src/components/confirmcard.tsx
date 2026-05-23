import React from 'react';
import type { ConfirmRequest } from '../client-types';

interface Props {
  confirmRequest: ConfirmRequest;
  onConfirm: (approved: boolean) => void;
}

export const ConfirmCard: React.FC<Props> = ({ confirmRequest, onConfirm }) => {
  const { tool, label, form, fieldLabels } = confirmRequest;
  const entries = Object.entries(fieldLabels).filter(([key]) => form[key] !== undefined);

  return (
    <div className="confirm-card">
      <div className="confirm-title">
        <span className="confirm-icon">🔒</span>
        {label}
      </div>
      <p className="confirm-subtitle">
        {tool === 'submit_form' ? '请核对以下信息后确认提交' : '请确认发起审批流程'}
      </p>
      <table className="form-table">
        <tbody>
          {entries.map(([key, label]) => (
            <tr key={key}>
              <td>{label}</td>
              <td><strong>{form[key]}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="confirm-actions">
        <button className="btn btn-reject" onClick={() => onConfirm(false)}>❌ 拒绝</button>
        <button className="btn btn-approve" onClick={() => onConfirm(true)}>
          ✅ {tool === 'submit_form' ? '确认提交' : '确认发起'}
        </button>
      </div>
    </div>
  );
};
