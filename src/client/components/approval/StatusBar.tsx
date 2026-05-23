/**
 * StatusBar — 流水线步骤指示器
 *
 * 将 Agent 工作阶段可视化为六步流水线：
 *   就绪 → 分析 → 填表 → 校验 → 确认 → 完成
 *
 * 每个步骤有三种状态：
 *   completed — 已完成（紫色标记）
 *   active    — 当前进行中（高亮 + 脉冲动画）
 *   pending   — 待执行（灰色）
 *   error     — 出错（红色）
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

/** 有序的流水线步骤定义 */
const PIPELINE_STEPS: StepInfo[] = [
  { key: 'idle',        label: '就绪' },
  { key: 'thinking',    label: '分析' },
  { key: 'filling',     label: '填表' },
  { key: 'validating',  label: '校验' },
  { key: 'confirming',  label: '确认' },
  { key: 'done',        label: '完成' },
];

/** 根据当前阶段判断某一步的状态 */
function getStepState(
  step: StepInfo,
  currentPhase: AgentPhase
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
  // idle 阶段只显示第一步，之后隐藏 idle 显示剩余步骤
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
              {/* 步骤间箭头 */}
              {i > 0 && <span className="pipeline-arrow" aria-hidden="true">›</span>}
              {/* 步骤胶囊 */}
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
