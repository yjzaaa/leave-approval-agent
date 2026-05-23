import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { BusinessPlugin } from '../../shared/plugin.js';
import { requestConfirm } from '../confirm-state.js';

/**
 * 通用提交 Tool 工厂
 *
 * 执行前通过 requestConfirm 等待用户确认 (Human-in-the-Loop)，
 * 确认通过后调用 plugin.submitApi。
 *
 * @param plugin 业务插件实例
 * @returns submit Tool
 */
export function createSubmitTool(plugin: BusinessPlugin): AgentTool<any> {
  const schemaFields: Record<string, any> = {};
  for (const f of plugin.fields) {
    schemaFields[f.key] = Type.String(f.required ? { description: f.label } : { description: `${f.label}(可选)` });
  }

  return {
    name: `${plugin.id}_submit`,
    label: plugin.confirmLabels?.submit || `提交${plugin.displayName}`,
    description: `提交${plugin.displayName}表单。必须先获得用户确认。`,
    parameters: Type.Object({ form: Type.Object(schemaFields) }),
    execute: async (_id: string, params: unknown) => {
      const { form } = params as { form: Record<string, string> };

      // Human-in-the-Loop: 等待用户确认
      const approved = await requestConfirm(`${plugin.id}_submit`, form);
      if (!approved) {
        throw new Error(`用户拒绝提交${plugin.displayName}`);
      }

      const result = await plugin.submitApi(form);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}
