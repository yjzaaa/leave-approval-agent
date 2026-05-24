import React from 'react';
import { cn } from '../../../lib/utils';
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
    <div
      className="h-10 border-b border-border bg-background flex items-center px-4 gap-3 text-xs overflow-x-auto"
      role="status"
      aria-live="polite"
      aria-label={`当前状态: ${text}`}
    >
      <div className="flex items-center gap-2 max-w-3xl mx-auto w-full">
        {visibleSteps.map((step, i) => {
          const state = getStepState(step, phase);
          return (
            <React.Fragment key={step.key}>
              {i > 0 && <span className="text-muted-foreground" aria-hidden="true">›</span>}
              <span
                className={cn(
                  'flex items-center gap-1.5',
                  state === 'completed' && 'text-green-600 dark:text-green-400',
                  state === 'active' && 'text-primary font-medium',
                  state === 'error' && 'text-destructive',
                  state === 'pending' && 'text-muted-foreground'
                )}
                aria-current={state === 'active' ? 'step' : undefined}
              >
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full bg-current',
                    state === 'active' && 'animate-pulse'
                  )}
                  aria-hidden="true"
                />
                {step.label}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
