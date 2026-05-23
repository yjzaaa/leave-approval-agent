import React from 'react';
import type { AgentPhase } from '../client-types';

interface Props {
  phase: AgentPhase;
  text: string;
}

const PHASE_MAP: Record<AgentPhase, { label: string; className: string }> = {
  idle: { label: '就绪', className: '' },
  thinking: { label: '思考中', className: '' },
  filling: { label: '填表中', className: '' },
  validating: { label: '校验中', className: '' },
  confirming: { label: '等待确认', className: 'confirm' },
  done: { label: '完成', className: '' },
  error: { label: '错误', className: 'error' },
};

export const StatusBar: React.FC<Props> = ({ phase, text }) => {
  const info = PHASE_MAP[phase];
  return (
    <div className="status-bar">
      <span className={`phase-badge ${info.className}`}>{info.label}</span>
      <span className="phase-text">{text}</span>
    </div>
  );
};
