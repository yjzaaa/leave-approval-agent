/**
 * App 根组件 v3.0
 *
 * 五大视觉区域：
 *   1. Header  — 顶部导航（支持动态标题）
 *   2. StatusBar — 流水线步骤指示器
 *   3. ChatContainer — 聊天消息列表
 *   4. InputBar — 消息输入框
 *   5. ConfirmCard — 确认弹窗（条件渲染）
 */
import React, { useState, useEffect } from 'react';
import { Header } from './client/components/layout/Header';
import { ThemeToggle } from './client/components/layout/ThemeToggle';
import { StatusBar } from './client/components/approval/StatusBar';
import { ChatContainer } from './client/components/chat/ChatContainer';
import { InputBar } from './client/components/chat/InputBar';
import { ConfirmCard } from './client/components/approval/ConfirmCard';
import { useAgent } from './client/hooks/useAgent';
import type { PluginInfo } from './client/types';

export default function App() {
  const {
    messages, phase, phaseText, confirmRequest,
    isStreaming, error,
    sendMessage, confirm, reset,
  } = useAgent();

  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [activePluginId, setActivePluginId] = useState('leave_approval');
  const [appTitle, setAppTitle] = useState('远程办公申请审批');

  // 加载可用插件列表
  useEffect(() => {
    fetch('/api/plugins')
      .then(r => r.json())
      .then(data => {
        setPlugins(data.plugins || []);
        const active = data.plugins?.find((p: PluginInfo) => p.id === activePluginId);
        if (active) setAppTitle(active.displayName);
      })
      .catch(() => {});
  }, []);

  /** 切换插件时重置对话 */
  const switchPlugin = (pluginId: string) => {
    const p = plugins.find(pl => pl.id === pluginId);
    if (p) {
      setActivePluginId(pluginId);
      setAppTitle(p.displayName);
      reset();
    }
  };

  return (
    <div className="app">
      <Header title={appTitle} />

      <main className="main-content">
        {/* 插件选择器 */}
        {plugins.length > 1 && (
          <div className="plugin-selector">
            {plugins.map(p => (
              <button
                key={p.id}
                className={`plugin-btn ${p.id === activePluginId ? 'active' : ''}`}
                onClick={() => switchPlugin(p.id)}
              >
                {p.displayName}
              </button>
            ))}
          </div>
        )}

        <StatusBar phase={phase} text={phaseText} />

        <ChatContainer messages={messages} />

        <InputBar onSend={sendMessage} disabled={isStreaming} />
      </main>

      {/* 确认弹窗（条件渲染） */}
      {confirmRequest && (
        <ConfirmCard
          confirmRequest={confirmRequest}
          onConfirm={confirm}
        />
      )}
    </div>
  );
};
