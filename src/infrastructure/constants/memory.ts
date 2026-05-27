/**
 * 记忆系统常量
 */

/** 记忆容量限制 */
export const MEMORY_LIMITS = {
  maxUserMemories: 20,
  maxFeedbackMemories: 15,
  maxProjectMemories: 10,
  maxReferenceMemories: 10,
  maxLearningsMemories: 20,
  maxMemoryTotalTokens: 2000,
  maxSummaryLength: 1000,
  compactThreshold: 16,
  extractInterval: 5,
} as const;

/** localStorage 键名 */
export const MEMORY_STORAGE_KEY = 'agent_memory_store';
