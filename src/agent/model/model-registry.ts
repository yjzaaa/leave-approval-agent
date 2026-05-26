/**
 * 模型注册表 — 声明式配置，环境变量驱动
 *
 * 不同用途（chat/utility）可以使用不同模型。
 * 环境变量优先级: 专用变量 > 通用变量 > 硬编码默认值。
 *
 * 环境变量:
 *   MODEL_PROVIDER        — chat 模型提供商 (默认: deepseek)
 *   MODEL_ID              — chat 模型 ID (默认: deepseek-v4-pro)
 *   UTILITY_MODEL_PROVIDER — utility 模型提供商 (默认: 回退到 MODEL_PROVIDER)
 *   UTILITY_MODEL_ID       — utility 模型 ID (默认: 回退到 MODEL_ID)
 */
import { getModel as piGetModel } from '@earendil-works/pi-ai';
import type { Model, Api } from '@earendil-works/pi-ai';

/** 模型配置项 */
export interface ModelSpec {
  /** 模型提供商 (pi-ai provider name) */
  provider: string;
  /** 模型 ID */
  modelId: string;
}

/** 模型角色 — 不同用途用不同模型 */
export type ModelRole = 'chat' | 'utility';

/** 模型注册表 — 声明式配置 */
const registry: Record<ModelRole, ModelSpec> = {
  chat: {
    provider: (typeof process !== 'undefined' && process.env?.MODEL_PROVIDER)
      ? process.env.MODEL_PROVIDER : 'deepseek',
    modelId: (typeof process !== 'undefined' && process.env?.MODEL_ID)
      ? process.env.MODEL_ID : 'deepseek-v4-pro',
  },
  utility: {
    provider: (typeof process !== 'undefined' && process.env?.UTILITY_MODEL_PROVIDER)
      ? process.env.UTILITY_MODEL_PROVIDER
      : (typeof process !== 'undefined' && process.env?.MODEL_PROVIDER)
        ? process.env.MODEL_PROVIDER : 'deepseek',
    modelId: (typeof process !== 'undefined' && process.env?.UTILITY_MODEL_ID)
      ? process.env.UTILITY_MODEL_ID
      : (typeof process !== 'undefined' && process.env?.MODEL_ID)
        ? process.env.MODEL_ID : 'deepseek-v4-pro',
  },
};

/** 按角色获取模型 */
export function getModel(role: ModelRole = 'chat'): Model<Api> {
  const spec = registry[role];
  return piGetModel(
    spec.provider as Parameters<typeof piGetModel>[0],
    spec.modelId as Parameters<typeof piGetModel>[1],
  );
}
