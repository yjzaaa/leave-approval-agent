/**
 * 记忆系统领域模型
 */
import type { MemoryType } from '../enums/MemoryType.js';

/** 单条记忆 */
export interface MemoryItem {
  /** 记忆内容 */
  content: string;
  /** 记忆类型 */
  type: MemoryType;
  /** 创建时间戳 */
  createdAt: number;
  /** 最后更新时间戳 */
  updatedAt: number;
}

/** 跨场景共享的记忆 (user + feedback) */
export interface SharedMemories {
  user: MemoryItem[];
  feedback: MemoryItem[];
}

/** 按场景隔离的记忆 (project + reference + learnings) */
export interface ScenarioMemories {
  project: MemoryItem[];
  reference: MemoryItem[];
  /** 领域知识沉淀 — 从历史对话中提取的正确参数、方法论、常见陷阱 */
  learnings: MemoryItem[];
}

/** 完整记忆存储 */
export interface MemoryStore {
  /** 共享记忆 */
  shared: SharedMemories;
  /** 按场景隔离的记忆: { [scenarioId]: ScenarioMemories } */
  byScenario: Record<string, ScenarioMemories>;
  /** 对话摘要 */
  summary: string;
  /** 摘要覆盖到第几条消息 */
  summaryUpTo: number;
}
