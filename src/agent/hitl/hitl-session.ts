/**
 * HITL 会话 — 封装 HitlManager 创建、tool 包装、SSE 事件桥接
 *
 * 将 HITL 管理器创建 + confirmTools 自动包装 + SSE 事件桥接
 * 三步操作封装为一个原子操作，消除 agent-factory 中的 HITL 样板代码。
 */
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { Scenario } from '../../models/domain/interfaces/IScenario.js';
import type { SSECallback } from '../../models/domain/interfaces/ISSE.js';
import type { ITracer } from '../../models/domain/interfaces/ITracer.js';
import { HitlManager } from './hitl-manager.js';
import { wrapHitlTools } from './hitl-wrappers.js';

/** 获取字段标签映射 */
function getFieldLabels(scenario: Scenario): Record<string, string> {
  const map: Record<string, string> = {};
  if (scenario.fields) {
    for (const f of scenario.fields) { map[f.key] = f.label; }
  }
  return map;
}

/** HITL 会话 — 一次 Agent 运行的 HITL 生命周期管理 */
export class HitlSession {
  readonly hitl: HitlManager;
  readonly tools: AgentTool[];

  constructor(
    scenario: Scenario,
    onSSE: SSECallback,
    fieldLabels: Record<string, string>,
    tracer?: ITracer,
  ) {
    this.hitl = new HitlManager({
      onEvent: (event) => {
        switch (event.type) {
          case 'confirm_required':
            tracer?.markHitl(event.tool);
            onSSE('confirm_required', {
              tool: event.tool,
              label: event.label ?? '📋 确认操作',
              form: scenario.formatFormForDisplay
                ? scenario.formatFormForDisplay(event.form as Record<string, string>)
                : event.form,
              fieldLabels,
            });
            break;
          case 'confirm_resolved':
            onSSE('confirm_resolved', { tool: event.tool });
            break;
        }
      },
    });

    this.tools = wrapHitlTools(
      scenario.tools,
      this.hitl,
      scenario.confirmTools || [],
    );
  }
}
