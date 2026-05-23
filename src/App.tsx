/**
 * App 根组件 v3.0
 *
 * 五大视觉区域：
 *   1. Header/插件下拉  — 顶部导航 + 业务插件选择器（始终显示）
 *   2. StatusBar       — 流水线步骤指示器
 *   3. ChatContainer   — 聊天消息列表 + 插件自适应快捷建议
 *   4. InputBar        — 消息输入框
 *   5. ConfirmCard     — 确认弹窗（条件渲染）
 */
import React, { useState, useEffect } from 'react';
import { Header } from './client/components/layout/Header';
import { StatusBar } from './client/components/approval/StatusBar';
import { ChatContainer } from './client/components/chat/ChatContainer';
import { InputBar } from './client/components/chat/InputBar';
import { ConfirmCard } from './client/components/approval/ConfirmCard';
import { useAgent } from './client/hooks/useAgent';
import type { PluginInfo } from './client/types';

/** 内置插件列表（API 失败时的兜底） */
const FALLBACK_PLUGINS: PluginInfo[] = [
  { id: 'leave_approval', displayName: '远程办公审批', fieldCount: 9 },
  { id: 'expense_approval', displayName: '报销审批', fieldCount: 8 },
  { id: 'sick_leave', displayName: '病假申请', fieldCount: 9 },
];

/** 各插件的默认快捷建议（API 不可用时兜底） */
const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  leave_approval: ['我需要申请远程办公', '家人住院需要照顾', '身体不适在家办公'],
  expense_approval: ['我需要报销差旅费', '办公用品报销申请', '客户招待费用报销'],
  sick_leave: ['我发烧了需要请病假', '身体不适请 3 天病假', '急性肠胃炎需要休息'],
};

export default function App() {
  const [plugins, setPlugins] = useState<PluginInfo[]>(FALLBACK_PLUGINS);
  const [activePluginId, setActivePluginId] = useState('leave_approval');
  const [appTitle, setAppTitle] = useState('远程办公申请审批');
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS.leave_approval);

  const {
    messages, phase, phaseText, confirmRequest,
    isStreaming, error,
    sendMessage, confirm, reset,
  } = useAgent({ pluginId: activePluginId });

  // 尝试从服务端加载插件列表（含 suggestions）
  useEffect(() => {
    fetch('/api/plugins')
      .then(r => r.json())
      .then(data => {
        if (data.plugins?.length > 0) {
          setPlugins(data.plugins);
          // 同步当前插件 suggestions
          const ap = data.plugins.find(
            (p: PluginInfo & { suggestions?: string[] }) => p.id === activePluginId
          );
          if (ap?.suggestions) setSuggestions(ap.suggestions);
        }
      })
      .catch(() => {
        console.log('[App] /api/plugins 不可用，使用内置插件列表');
      });
  }, []);

  /** 切换插件时重置对话 + 更新建议语 */
  const switchPlugin = (pluginId: string) => {
    const p = plugins.find(pl => pl.id === pluginId);
    if (p && pluginId !== activePluginId) {
      setActivePluginId(pluginId);
      setAppTitle(p.displayName);
      // 先应用本地兜底建议
      setSuggestions(DEFAULT_SUGGESTIONS[pluginId] || []);
      // 再从 API 拉取覆盖
      fetch('/api/plugins')
        .then(r => r.json())
        .then(data => {
          const sp = data.plugins?.find(
            (pl: PluginInfo & { suggestions?: string[] }) => pl.id === pluginId
          );
          if (sp?.suggestions) setSuggestions(sp.suggestions);
        })
        .catch(() => {});
      reset();
    }
  };

  // 初始化标题（插件加载后）
  useEffect(() => {
    const active = plugins.find(p => p.id === activePluginId);
    if (active) setAppTitle(active.displayName);
  }, [plugins]);

  return (
    <div className="app">
      <Header title={appTitle}>
        {/* 业务插件下拉选择器（始终显示） */}
        <div className="plugin-selector">
          <label htmlFor="plugin-select" className="plugin-selector-label">📋</label>
          <select
            id="plugin-select"
            className="plugin-select"
            value={activePluginId}
            onChange={e => switchPlugin(e.target.value)}
            aria-label="选择审批类型"
          >
            {plugins.map(p => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </select>
        </div>
      </Header>

      <main className="main-content">
        <StatusBar phase={phase} text={phaseText} />

        <ChatContainer messages={messages} suggestions={suggestions} />

        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </main>

      {/* 确认弹窗（条件渲染） */}
      {confirmRequest && (
        <ConfirmCard confirmRequest={confirmRequest} onConfirm={confirm} />
      )}
    </div>
  );
};
