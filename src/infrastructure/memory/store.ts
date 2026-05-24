/**
 * 记忆存储运行时函数
 */
import type { MemoryStore, MemoryItem, ScenarioMemories } from '../../domain/models/MemoryItem.js';

/** 创建空的记忆存储 */
export function createEmptyStore(): MemoryStore {
  return {
    shared: { user: [], feedback: [] },
    byScenario: {},
    summary: '',
    summaryUpTo: 0,
  };
}

/** 获取指定场景的记忆（含共享 + 隔离） */
export function getScenarioMemories(store: MemoryStore, scenarioId: string): MemoryItem[] {
  const byScenario = store.byScenario || {};
  const scenario: ScenarioMemories = byScenario[scenarioId] || { project: [], reference: [] };
  return [
    ...store.shared.user,
    ...store.shared.feedback,
    ...scenario.project,
    ...scenario.reference,
  ];
}
