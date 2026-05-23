import React from 'react';
import type { AgentPhase } from '../../types';

interface Props {
  phase: AgentPhase;
  text: string;
}

interface StepInfo {
  key: AgentPhase;
  label: string;
}

const PIPELINE_STEPS: StepInfo[] = [
  { key: 'idle',              label: '就绪' },
  { key: 'processing',        label: '处理中' },
  { key: 'awaiting_confirm',  label: '等待确认' },
  { key: 'done',              label: '完成' },
];

function getStepState(step: StepInfo, currentPhase: AgentPhase): 'completed' | 'active' | 'pending' | 'error' {
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.key === step.key);
  const currentIndex = PIPELINE_STEPS.findIndex(s => s.key === currentPhase);
  if (currentPhase === 'error') {
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'error';
    return 'pending';
  }
  if (currentPhase === 'done') return 'completed';
  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export const StatusBar: React.FC<Props> = ({ phase, text }) => {
  const visibleSteps = phase === 'idle' ? PIPELINE_STEPS.slice(0, 1) : PIPELINE_STEPS.slice(1);
  return (
    <div className="status-bar" role="status" aria-live="polite" aria-label={`当前状态: ${text}`}>
      <div className="pipeline">
        {visibleSteps.map((step, i) => {
          const state = getStepState(step, phase);
          return (
            <React.Fragment key={step.key}>
              {i > 0 && <span className="pipeline-arrow" aria-hidden="true">›</span>}
              <span className={`pipeline-step ${state}`} aria-current={state === 'active' ? 'step' : undefined}>
                <span className="pipeline-step-dot" aria-hidden="true" />
                {step.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
