/**
 * HITL 工具包装器 — 声明式注入确认流程
 *
 * withConfirm: 单个 tool 的 HITL 包装
 * wrapHitlTools: 批量包装 confirmTools
 */
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { ConfirmToolConfig } from '../../models/domain/interfaces/ConfirmToolConfig.js';
import type { HitlManager } from './hitl-manager.js';

/**
 * 包装 AgentTool，在执行前自动注入 HITL 确认
 *
 * @param tool 原始 tool（只含业务逻辑）
 * @param hitl HitlManager 实例
 * @param options.label 确认弹窗标题
 */
export function withConfirm<T extends AgentTool>(
  tool: T,
  hitl: HitlManager,
  options?: { label?: string },
): T {
  const originalExecute = tool.execute;
  return {
    ...tool,
    execute: async (id, params, signal, onUpdate) => {
      const approved = await hitl.requestConfirm(tool.name, params, { label: options?.label });
      if (!approved) throw new Error(`用户拒绝执行「${tool.label}」`);
      return originalExecute(id, params, signal, onUpdate);
    },
  };
}

/** 批量包装 HITL tools — 对 confirmTools 中声明的 tool 注入 HITL */
export function wrapHitlTools(
  tools: AgentTool[],
  hitl: HitlManager,
  confirmTools: ConfirmToolConfig[],
): AgentTool[] {
  const map = new Map(confirmTools.map(c => [c.name, c.label]));
  return tools.map(tool => {
    if (map.has(tool.name)) {
      return withConfirm(tool, hitl, { label: map.get(tool.name) });
    }
    return tool;
  });
}
