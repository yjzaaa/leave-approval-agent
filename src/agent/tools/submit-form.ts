/**
 * 通用提交 Tool 工厂
 *
 * HITL 解耦：只有当 tool 名在 plugin.confirmTools 中时才触发用户确认。
 * 不在 confirmTools 中 → 直接调用 submitApi，无 HITL。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { BusinessPlugin } from '../../shared/plugin.js';
import { requestConfirm } from '../confirm-state.js';

export function createSubmitTool(plugin: BusinessPlugin): AgentTool<any> {
  const schemaFields: Record<string, any> = {};
  for (const f of plugin.fields) {
    schemaFields[f.key] = Type.String(f.required ? { description: f.label } : { description: `${f.label}(可选)` });
  }

  const toolName = `${plugin.id}_submit`;
  const confirmTools = plugin.confirmTools || [];
  const needsConfirm = confirmTools.includes(toolName);

  return {
    name: toolName,
    label: (plugin.confirmLabels && plugin.confirmLabels[toolName]) || `提交${plugin.displayName}`,
    description: `提交${plugin.displayName}表单。${needsConfirm ? '需要用户确认。' : ''}`,
    parameters: Type.Object({ form: Type.Object(schemaFields) }),
    execute: async (_id: string, params: unknown) => {
      const { form } = params as { form: Record<string, string> };

      // ★ HITL: 只在 confirmTools 包含此 tool 时才等待确认
      if (needsConfirm) {
        const approved = await requestConfirm(toolName, form);
        if (!approved) {
          throw new Error(`用户拒绝提交${plugin.displayName}`);
        }
      }

      const result = await plugin.submitApi(form);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}
