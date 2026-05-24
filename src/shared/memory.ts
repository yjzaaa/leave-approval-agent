/**
 * 记忆系统类型定义
 *
 * 记忆分层:
 *   - 用户记忆 (user): 跨场景共享，用户画像/偏好
 *   - 反馈记忆 (feedback): 跨场景共享，用户纠正/确认
 *   - 项目记忆 (project): 按场景隔离，业务上下文
 *   - 引用记忆 (reference): 按场景隔离，外部资源指针
 *
 * 存储: 前端 localStorage，服务端无状态
 */

/** 记忆类型枚举 */
export type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

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

/** 按场景隔离的记忆 (project + reference) */
export interface ScenarioMemories {
  project: MemoryItem[];
  reference: MemoryItem[];
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

/** 记忆容量限制 */
export const MEMORY_LIMITS = {
  maxUserMemories: 20,
  maxFeedbackMemories: 15,
  maxProjectMemories: 10,
  maxReferenceMemories: 10,
  maxMemoryTotalTokens: 2000,
  maxSummaryLength: 1000,
  compactThreshold: 16,      // 消息数超过此值触发压缩
  extractInterval: 5,         // 每 N 轮提取一次记忆
} as const;

/** localStorage 键名 */
export const MEMORY_STORAGE_KEY = 'agent_memory_store';

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
  const scenario = byScenario[scenarioId] || { project: [], reference: [] };
  return [
    ...store.shared.user,
    ...store.shared.feedback,
    ...scenario.project,
    ...scenario.reference,
  ];
}