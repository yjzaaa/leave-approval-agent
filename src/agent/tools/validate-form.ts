import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { BusinessPlugin } from '../../shared/plugin.js';

/**
 * 通用校验 Tool 工厂
 *
 * 根据 plugin 的 fields 定义动态生成参数 Schema，
 * 校验逻辑委托给 plugin.validate。
 *
 * @param plugin 业务插件实例
 * @returns 校验表单的 AgentTool
 */
export function createValidateTool(plugin: BusinessPlugin): AgentTool<any> {
  // 根据 fields 动态构建参数 schema
  const schemaFields: Record<string, any> = {};
  for (const f of plugin.fields) {
    schemaFields[f.key] = Type.String(f.required ? { description: f.label } : { description: `${f.label}(可选)` });
  }

  return {
    name: `${plugin.id}_validate`,
    label: `校验${plugin.displayName}`,
    description: `校验${plugin.displayName}表单，返回 { valid, errors[] }。`,
    parameters: Type.Object({ form: Type.Object(schemaFields) }),
    execute: async (_id: string, params: unknown) => {
      const { form } = params as { form: Record<string, string> };
      const result = plugin.validate(form);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(result) }],
        details: result,
      };
    },
  };
}
