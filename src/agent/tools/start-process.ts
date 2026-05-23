/**
 * 通用流程发起 Tool 工厂
 *
 * HITL 解耦：只有当 tool 名在 plugin.confirmTools 中时才触发用户确认。
 * 不在 confirmTools 中 → 直接调用 startProcessApi，无 HITL。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { BusinessPlugin } from '../../shared/plugin.js';
import { requestConfirm } from '../confirm-state.js';

export function createStartProcessTool(plugin: BusinessPlugin): AgentTool<any> {
  const schemaFields: Record<string, any> = {};
  for (const f of plugin.fields) {
    schemaFields[f.key] = Type.String(f.required ? { description: f.label } : { description: `${f.label}(可选)` });
  }

  const toolName = `${plugin.id}_start`;
  const confirmTools = plugin.confirmTools || [];
  const needsConfirm = confirmTools.includes(toolName);

  return {
    name: toolName,
    label: (plugin.confirmLabels && plugin.confirmLabels[toolName]) || `发起${plugin.displayName}流程`,
    description: `发起${plugin.displayName}审批流程。${needsConfirm ? '需要用户确认。' : ''}`,
    parameters: Type.Object({
      resultId: Type.String(),
      form: Type.Object(schemaFields),
    }),
    execute: async (_id: string, params: unknown) => {
      const { resultId, form } = params as { resultId: string; form: Record<string, string> };

      // ★ HITL: 只在 confirmTools 包含此 tool 时才等待确认
      if (needsConfirm) {
        const approved = await requestConfirm(toolName, { resultId, form });
        if (!approved) {
          throw new Error(`用户拒绝发起${plugin.displayName}流程`);
        }
      }

      const result = await plugin.startProcessApi(resultId, form);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}
