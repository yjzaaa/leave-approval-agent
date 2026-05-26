import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../../infrastructure/utils/cn';
import type { AgentPhase } from '../../types';

interface Props {
  phase: AgentPhase;
  text: string;
}

const STEP_KEYS: AgentPhase[] = ['idle', 'processing', 'awaiting_confirm', 'done'];

function getStepState(stepKey: AgentPhase, currentPhase: AgentPhase): 'completed' | 'active' | 'pending' | 'error' {
  const stepIndex = STEP_KEYS.indexOf(stepKey);
  const currentIndex = STEP_KEYS.indexOf(currentPhase);
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

const PHASE_TO_LABEL_KEY: Record<AgentPhase, string> = {
  idle: 'status.idle',
  processing: 'status.processing',
  awaiting_confirm: 'status.awaitingConfirm',
  done: 'status.done',
  error: 'status.done',
};

export const StatusBar: React.FC<Props> = ({ phase, text }) => {
  const { t } = useTranslation();
  const visibleKeys = phase === 'idle' ? STEP_KEYS.slice(0, 1) : STEP_KEYS.slice(1);

  return (
    <div
      className="h-10 border-b border-border bg-background flex items-center px-4 gap-3 text-xs overflow-x-auto"
      role="status"
      aria-live="polite"
      aria-label={t('status.ariaLabel', { text })}
    >
      <div className="flex items-center gap-2 max-w-3xl mx-auto w-full">
        {visibleKeys.map((key, i) => {
          const state = getStepState(key, phase);
          return (
            <React.Fragment key={key}>
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
                {t(PHASE_TO_LABEL_KEY[key] as string, { defaultValue: PHASE_TO_LABEL_KEY[key] })}
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};