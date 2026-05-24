/**
 * React 应用入口 — 挂载根组件到 #root DOM 节点
 * Suspense 包裹以支持 i18next 语言检测就绪态
 */
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="flex h-dvh items-center justify-center bg-background" />}>
      <App />
    </Suspense>
  </React.StrictMode>
);
