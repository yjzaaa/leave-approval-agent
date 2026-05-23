/**
 * 应用根组件
 * 组合 Header / StatusBar / Chat / InputBar / ConfirmCard 五大区域
 * 通过 useAgent hook 管理全局状态
 */
import React from 'react';
import { Header } from './client/components/layout/Header';
import { StatusBar } from './client/components/approval/StatusBar';
import { ChatContainer } from './client/components/chat/ChatContainer';
import { ConfirmCard } from './client/components/approval/ConfirmCard';
import { InputBar } from './client/components/chat/InputBar';
import { useAgent } from './client/hooks/useAgent';

const App: React.FC = () => {
  // 从 useAgent hook 获取全部状态和操作方法
  const {
    messages, phase, phaseText, confirmRequest,
    isStreaming, sendMessage, confirm,
  } = useAgent();

  return (
    <div className="app">
      <Header />
      <StatusBar phase={phase} text={phaseText} />
      <ChatContainer messages={messages} />
      <InputBar onSend={sendMessage} disabled={isStreaming} />

      {/* 确认弹窗：仅在有确认请求时渲染，覆盖在聊天区上方 */}
      {confirmRequest && (
        <ConfirmCard confirmRequest={confirmRequest} onConfirm={confirm} />
      )}
    </div>
  );
};

export default App;
