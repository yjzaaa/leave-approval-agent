/**
 * Model Provider — 兼容旧接口的薄包装
 *
 * 内部委托给 model-registry.ts。
 * 新代码请直接使用 getModel(role)。
 */
import type { Model, Api } from '@earendil-works/pi-ai';
import { getModel } from './model-registry.js';

/** 获取默认模型 (chat 角色) — 兼容旧接口 */
export function getDefaultModel(): Model<Api> {
  return getModel('chat');
}
