/**
 * 基础设施层依赖注册
 *
 * 注册模型提供者、Tracer 工厂、HITL 会话存储。
 * registerInfrastructure 是组合根的一部分，import 来自 agent/ 层的具体实现并包装到容器中。
 */
import type { Plugin } from './context.js';
import { getModel } from '../../agent/model/index.js';
import { createTracer } from '../../agent/tracing/index.js';
import type { HitlManager } from '../../agent/hitl/index.js';
import type { Model, Api } from '@earendil-works/pi-ai';
import type { ITracer, TracerOptions } from '../../models/domain/interfaces/ITracer.js';

/** 模型提供者 — 按角色获取模型 */
export type ModelProvider = (role?: 'chat' | 'utility') => Model<Api>;

/** Tracer 工厂 — 根据环境自动选择 RestTracer / NoopTracer */
export type TracerFactory = (opts: TracerOptions) => Promise<ITracer>;

/** HITL 会话存储 — 替代 app.locals.hitlSessions */
export type HitlSessionStore = Map<string, HitlManager>;

/** 注册 infrastructure 层依赖 */
export const registerInfrastructure: Plugin = (ctx) => {
  ctx.singleton<ModelProvider>('modelProvider', () => getModel);
  ctx.singleton<TracerFactory>('tracerFactory', () => createTracer);
  ctx.singleton<HitlSessionStore>('sessionStore', () => new Map());
};
