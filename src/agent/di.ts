/**
 * Agent 层依赖注册
 *
 * 注册 startAgent（预先注入 model）、hitlFactory。
 * 依赖: modelProvider (来自 registerInfrastructure)
 */
import type { Plugin } from '../infrastructure/di/context.js';
import type { ModelProvider } from '../infrastructure/di/index.js';
import { startAgent } from './core/agent-factory.js';
import { HitlSession } from './hitl/index.js';
import type { AgentRunParams, AgentRun } from './core/agent-factory.js';
import type { Scenario } from '../models/domain/interfaces/IScenario.js';
import type { IAgentEventBus } from '../models/domain/interfaces/IEventBus.js';
import type { ITracer } from '../models/domain/interfaces/ITracer.js';

/** 已注入基础依赖的 startAgent 类型 */
export type AgentRunner = (params: Omit<AgentRunParams, 'model'>) => AgentRun;

/** HITL 会话工厂 */
export type HitlSessionFactory = (
  scenario: Scenario,
  eventBus: IAgentEventBus,
  tracer?: ITracer,
) => HitlSession;

export const registerAgent: Plugin = (ctx) => {
  // ── AgentRunner — 在 startAgent 外封装 modelProvider 注入 ──
  ctx.singleton<AgentRunner>('startAgent', (c) => {
    const modelProvider = c.get<ModelProvider>('modelProvider');
    const model = modelProvider('chat');
    return (params) => startAgent({ ...params, model });
  });

  // ── HITL 会话工厂 ──
  ctx.singleton<HitlSessionFactory>('hitlFactory', () => {
    return (scenario, eventBus, tracer) => {
      // 从 scenario 中提取字段标签映射
      const fieldLabels: Record<string, string> = {};
      if (scenario.fields) {
        for (const f of scenario.fields) { fieldLabels[f.key] = f.label; }
      }
      return new HitlSession(scenario, eventBus, fieldLabels, tracer);
    };
  });
};
