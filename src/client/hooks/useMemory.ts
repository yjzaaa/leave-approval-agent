/**
 * 记忆管理 Hook — localStorage 持久化
 *
 * 负责:
 *   - 记忆的 CRUD 操作
 *   - localStorage 读写
 *   - 按场景隔离/跨场景共享
 *   - 容量控制 (FIFO 淘汰)
 */
import { useState, useCallback, useEffect } from 'react';
import type { MemoryType } from '../../domain/enums/MemoryType.js';
import type { MemoryItem, MemoryStore, SharedMemories, ScenarioMemories } from '../../domain/models/MemoryItem.js';
import { MEMORY_LIMITS, MEMORY_STORAGE_KEY } from '../../infrastructure/constants/memory.js';
import { createEmptyStore, getScenarioMemories } from '../../infrastructure/memory/store.js';

/** 按用户 ID 生成 localStorage key */
function getStorageKey(userId: string): string {
  return `agent_memory_store_${userId}`;
}

function loadStore(userId: string): MemoryStore {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) {
      const store = JSON.parse(raw);
      // 兼容旧版 localStorage 数据：byPlugin → byScenario
      if (!store.byScenario && store.byPlugin) {
        store.byScenario = store.byPlugin;
        delete store.byPlugin;
      }
      return store;
    }
  } catch { /* ignore */ }
  return createEmptyStore();
}

function saveStore(userId: string, store: MemoryStore): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(store));
  } catch { /* ignore */ }
}

/** 获取某类型记忆的容量上限 */
function getLimit(type: MemoryType): number {
  switch (type) {
    case 'user': return MEMORY_LIMITS.maxUserMemories;
    case 'feedback': return MEMORY_LIMITS.maxFeedbackMemories;
    case 'project': return MEMORY_LIMITS.maxProjectMemories;
    case 'reference': return MEMORY_LIMITS.maxReferenceMemories;
  }
}

/** 裁剪记忆列表到上限 (FIFO) */
function trimToLimit(items: MemoryItem[], limit: number): MemoryItem[] {
  if (items.length <= limit) return items;
  return items.slice(items.length - limit);
}

export interface UseMemoryReturn {
  /** 完整记忆存储 */
  store: MemoryStore;
  /** 获取指定场景的全部记忆 (共享+隔离) */
  getMemories: (scenarioId: string) => MemoryItem[];
  /** 添加共享记忆 (user/feedback) */
  addSharedMemory: (type: 'user' | 'feedback', content: string) => void;
  /** 添加场景隔离记忆 (project/reference) */
  addScenarioMemory: (scenarioId: string, type: 'project' | 'reference', content: string) => void;
  /** 删除指定记忆 */
  removeMemory: (type: MemoryType, index: number, scenarioId?: string) => void;
  /** 更新对话摘要 */
  setSummary: (summary: string, upTo: number) => void;
  /** 清空所有记忆 */
  clearAll: () => void;
  /** 清空指定场景的对话 */
  clearScenario: (scenarioId: string) => void;
}

/** 记忆管理 Hook */
export function useMemory(userId: string): UseMemoryReturn {
  const [store, setStore] = useState<MemoryStore>(() => loadStore(userId));

  // 每次变更后持久化
  useEffect(() => {
    saveStore(userId, store);
  }, [store, userId]);

  const getMemories = useCallback((scenarioId: string): MemoryItem[] => {
    return getScenarioMemories(store, scenarioId);
  }, [store]);

  const addSharedMemory = useCallback((type: 'user' | 'feedback', content: string) => {
    setStore(prev => {
      const now = Date.now();
      const item: MemoryItem = { content, type, createdAt: now, updatedAt: now };
      const list = [...prev.shared[type], item];
      return {
        ...prev,
        shared: {
          ...prev.shared,
          [type]: trimToLimit(list, getLimit(type)),
        },
      };
    });
  }, []);

  const addScenarioMemory = useCallback((scenarioId: string, type: 'project' | 'reference', content: string) => {
    setStore(prev => {
      const now = Date.now();
      const item: MemoryItem = { content, type, createdAt: now, updatedAt: now };
      const scenarioMem = prev.byScenario[scenarioId] || { project: [], reference: [] };
      const list = [...scenarioMem[type], item];
      return {
        ...prev,
        byScenario: {
          ...prev.byScenario,
          [scenarioId]: {
            ...scenarioMem,
            [type]: trimToLimit(list, getLimit(type)),
          },
        },
      };
    });
  }, []);

  const removeMemory = useCallback((type: MemoryType, index: number, scenarioId?: string) => {
    setStore(prev => {
      if (type === 'user' || type === 'feedback') {
        const list = [...prev.shared[type]];
        list.splice(index, 1);
        return { ...prev, shared: { ...prev.shared, [type]: list } };
      } else {
        if (!scenarioId) return prev;
        const scenarioMem = prev.byScenario[scenarioId];
        if (!scenarioMem) return prev;
        const list = [...scenarioMem[type]];
        list.splice(index, 1);
        return {
          ...prev,
          byScenario: {
            ...prev.byScenario,
            [scenarioId]: { ...scenarioMem, [type]: list },
          },
        };
      }
    });
  }, []);

  const setSummary = useCallback((summary: string, upTo: number) => {
    setStore(prev => ({
      ...prev,
      summary: summary.slice(0, MEMORY_LIMITS.maxSummaryLength),
      summaryUpTo: upTo,
    }));
  }, []);

  const clearAll = useCallback(() => {
    setStore(createEmptyStore());
  }, []);

  const clearScenario = useCallback((scenarioId: string) => {
    setStore(prev => {
      const { [scenarioId]: _, ...rest } = prev.byScenario;
      return { ...prev, byScenario: rest, summary: '', summaryUpTo: 0 };
    });
  }, []);

  return {
    store,
    getMemories,
    addSharedMemory,
    addScenarioMemory,
    removeMemory,
    setSummary,
    clearAll,
    clearScenario,
  };
}