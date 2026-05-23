import React from 'react';
import { Header } from './client/components/layout/Header';
import { StatusBar } from './client/components/approval/StatusBar';
import { ChatContainer } from './client/components/chat/ChatContainer';
import { ConfirmCard } from './client/components/approval/ConfirmCard';
import { InputBar } from './client/components/chat/InputBar';
import { useAgent } from './client/hooks/useAgent';

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

      {confirmRequest && (
        <ConfirmCard confirmRequest={confirmRequest} onConfirm={confirm} />
      )}
    </div>
  );
};

export default App;
