/**
 * StatusBar — 流水线步骤指示器 v3.0
 *
 * 与业务解耦：不再硬编码"填表→校验→确认→完成"。
 * 改为通用的四步流水线：就绪 → 处理中 → 等待确认 → 完成。
 *
 * 未来可从插件的 pipeline 定义动态渲染步骤。
 */
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

/** 通用流水线步骤定义 */
const PIPELINE_STEPS: StepInfo[] = [
  { key: 'idle',              label: '就绪' },
  { key: 'processing',        label: '处理中' },
  { key: 'awaiting_confirm',  label: '等待确认' },
  { key: 'done',              label: '完成' },
];

/** 根据当前阶段判断某一步的状态 */
function getStepState(
  step: StepInfo,
  currentPhase: AgentPhase,
): 'completed' | 'active' | 'pending' | 'error' {
  const stepIndex = PIPELINE_STEPS.findIndex(s => s.key === step.key);
  const currentIndex = PIPELINE_STEPS.findIndex(s => s.key === currentPhase);

  if (currentPhase === 'error') {
    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'error';
    return 'pending';
  }

  if (stepIndex < currentIndex) return 'completed';
  if (stepIndex === currentIndex) return 'active';
  return 'pending';
}

export const StatusBar: React.FC<Props> = ({ phase, text }) => {
  // idle 阶段只显示第一步
  const visibleSteps = phase === 'idle'
    ? PIPELINE_STEPS.slice(0, 1)
    : PIPELINE_STEPS.slice(1);

  return (
    <div className="status-bar" role="status" aria-live="polite" aria-label={`当前状态: ${text}`}>
      <div className="pipeline">
        {visibleSteps.map((step, i) => {
          const state = getStepState(step, phase);
          return (
            <React.Fragment key={step.key}>
              {i > 0 && <span className="pipeline-arrow" aria-hidden="true">›</span>}
              <span
                className={`pipeline-step ${state}`}
                aria-current={state === 'active' ? 'step' : undefined}
              >
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
