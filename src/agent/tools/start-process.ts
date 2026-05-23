import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { BusinessPlugin } from '../../shared/plugin.js';
import { requestConfirm } from '../confirm-state.js';

/**
 * 通用流程发起 Tool 工厂
 *
 * 执行前通过 requestConfirm 等待用户二次确认 (Human-in-the-Loop)，
 * 确认通过后调用 plugin.startProcessApi。
 *
 * @param plugin 业务插件实例
 * @returns startProcess Tool
 */
export function createStartProcessTool(plugin: BusinessPlugin): AgentTool<any> {
  const schemaFields: Record<string, any> = {};
  for (const f of plugin.fields) {
    schemaFields[f.key] = Type.String(f.required ? { description: f.label } : { description: `${f.label}(可选)` });
  }

  return {
    name: `${plugin.id}_start`,
    label: plugin.confirmLabels?.start || `发起${plugin.displayName}流程`,
    description: `发起${plugin.displayName}审批流程，需要 resultId。必须先获得用户确认。`,
    parameters: Type.Object({
      resultId: Type.String(),
      form: Type.Object(schemaFields),
    }),
    execute: async (_id: string, params: unknown) => {
      const { resultId, form } = params as { resultId: string; form: Record<string, string> };

      // Human-in-the-Loop: 等待用户二次确认
      const approved = await requestConfirm(`${plugin.id}_start`, { resultId, form });
      if (!approved) {
        throw new Error(`用户拒绝发起${plugin.displayName}流程`);
      }

      const result = await plugin.startProcessApi(resultId, form);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}
