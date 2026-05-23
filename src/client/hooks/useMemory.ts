/**
 * 记忆管理 Hook — localStorage 持久化
 *
 * 负责:
 *   - 记忆的 CRUD 操作
 *   - localStorage 读写
 *   - 按插件隔离/跨插件共享
 *   - 容量控制 (FIFO 淘汰)
 */
import { useState, useCallback, useEffect } from 'react';
import {
  type MemoryStore, type MemoryItem, type MemoryType,
  MEMORY_STORAGE_KEY, MEMORY_LIMITS,
  createEmptyStore, getPluginMemories,
} from '../../shared/memory.js';

/** 从 localStorage 加载记忆 */
function loadStore(): MemoryStore {
  try {
    const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return createEmptyStore();
}

/** 保存记忆到 localStorage */
function saveStore(store: MemoryStore): void {
  try {
    localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(store));
  } catch { /* ignore - quota exceeded */ }
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
  /** 获取指定插件的全部记忆 (共享+隔离) */
  getMemories: (pluginId: string) => MemoryItem[];
  /** 添加共享记忆 (user/feedback) */
  addSharedMemory: (type: 'user' | 'feedback', content: string) => void;
  /** 添加插件隔离记忆 (project/reference) */
  addPluginMemory: (pluginId: string, type: 'project' | 'reference', content: string) => void;
  /** 删除指定记忆 */
  removeMemory: (type: MemoryType, index: number, pluginId?: string) => void;
  /** 更新对话摘要 */
  setSummary: (summary: string, upTo: number) => void;
  /** 清空所有记忆 */
  clearAll: () => void;
  /** 清空指定插件的对话 */
  clearPlugin: (pluginId: string) => void;
}

/** 记忆管理 Hook */
export function useMemory(): UseMemoryReturn {
  const [store, setStore] = useState<MemoryStore>(loadStore);

  // 每次变更后持久化
  useEffect(() => {
    saveStore(store);
  }, [store]);

  const getMemories = useCallback((pluginId: string): MemoryItem[] => {
    return getPluginMemories(store, pluginId);
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

  const addPluginMemory = useCallback((pluginId: string, type: 'project' | 'reference', content: string) => {
    setStore(prev => {
      const now = Date.now();
      const item: MemoryItem = { content, type, createdAt: now, updatedAt: now };
      const pluginMem = prev.byPlugin[pluginId] || { project: [], reference: [] };
      const list = [...pluginMem[type], item];
      return {
        ...prev,
        byPlugin: {
          ...prev.byPlugin,
          [pluginId]: {
            ...pluginMem,
            [type]: trimToLimit(list, getLimit(type)),
          },
        },
      };
    });
  }, []);

  const removeMemory = useCallback((type: MemoryType, index: number, pluginId?: string) => {
    setStore(prev => {
      if (type === 'user' || type === 'feedback') {
        const list = [...prev.shared[type]];
        list.splice(index, 1);
        return { ...prev, shared: { ...prev.shared, [type]: list } };
      } else {
        if (!pluginId) return prev;
        const pluginMem = prev.byPlugin[pluginId];
        if (!pluginMem) return prev;
        const list = [...pluginMem[type]];
        list.splice(index, 1);
        return {
          ...prev,
          byPlugin: {
            ...prev.byPlugin,
            [pluginId]: { ...pluginMem, [type]: list },
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

  const clearPlugin = useCallback((pluginId: string) => {
    setStore(prev => {
      const { [pluginId]: _, ...rest } = prev.byPlugin;
      return { ...prev, byPlugin: rest, summary: '', summaryUpTo: 0 };
    });
  }, []);

  return {
    store,
    getMemories,
    addSharedMemory,
    addPluginMemory,
    removeMemory,
    setSummary,
    clearAll,
    clearPlugin,
  };
}