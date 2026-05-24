import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import 'dotenv/config';

export default defineConfig(({ mode }) => {
  /** server 模式: Express 代理 /api → :3000；local 模式: 浏览器直接运行 Agent */
  const isLocal = mode !== 'server';

  return {
    define: {
      /** Agent 模式标记 — useAgent Hook 据此选择 server / local 分支 */
      __AGENT_MODE__: JSON.stringify(isLocal ? 'local' : 'server'),
      /** DeepSeek API Key — 构建时从环境变量注入（local 模式需要在浏览器中使用） */
      'process.env.DEEPSEEK_API_KEY': JSON.stringify(process.env.DEEPSEEK_API_KEY || ''),
      /** MLflow — local 模式强制为空（跳过浏览器端 mlflow 初始化） */
      'process.env.MLFLOW_TRACKING_URI': JSON.stringify(isLocal ? '' : (process.env.MLFLOW_TRACKING_URI || '')),
    },
    plugins: [react(), tailwindcss()],
    server: {
      port: 5173,
      // server 模式下代理 /api → Express；local 模式无需代理
      ...(isLocal ? {} : {
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      }),
    },
  };
});
