/**
 * 场景层依赖注册
 *
 * 注册场景解析器，包装 registry.ts 的 getScenario / getDefaultScenario。
 */
import type { Plugin } from '../../infrastructure/di/context.js';
import type { Scenario } from '../domain/interfaces/IScenario.js';
import { registry, getScenario, getDefaultScenario } from './registry.js';

/** 场景解析器 — 按 ID 查找场景 */
export interface ScenarioResolver {
  getScenario(id: string): Scenario;
  getDefaultScenario(): Scenario;
  /** 获取场景元数据列表（供 /api/scenarios 使用） */
  listScenarios(): Array<{ id: string; displayName: string; fieldCount: number; suggestions: string[] }>;
}

export const registerScenarios: Plugin = (ctx) => {
  ctx.singleton<ScenarioResolver>('scenarioResolver', () => ({
    getScenario,
    getDefaultScenario,
    listScenarios: () =>
      Object.entries(registry).map(([id, p]) => ({
        id,
        displayName: p.displayName,
        fieldCount: p.fields?.length || 0,
        suggestions: p.suggestions || [],
      })),
  }));
};
