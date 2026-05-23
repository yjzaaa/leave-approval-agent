import React from 'react';
import { Header } from './components/Header';
import { StatusBar } from './components/StatusBar';
import { ChatContainer } from './components/ChatContainer';
import { ConfirmCard } from './components/ConfirmCard';
import { InputBar } from './components/InputBar';
import { useAgent } from './hooks/useAgent';

const App: React.FC = () => {
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

      {/* Modal 遮罩层 — 渲染在最顶层 */}
      {confirmRequest && (
        <ConfirmCard confirmRequest={confirmRequest} onConfirm={confirm} />
      )}
    </div>
  );
};

export default App;
