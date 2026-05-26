import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import 'dotenv/config';
import { createApp } from './src/controllers/server/index.js';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    /** MLflow — 未设置时自动 no-op */
    'process.env.MLFLOW_TRACKING_URI': JSON.stringify(process.env.MLFLOW_TRACKING_URI || ''),
    'process.env.MLFLOW_EXPERIMENT_ID': JSON.stringify(process.env.MLFLOW_EXPERIMENT_ID || '0'),
  },
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'express-middleware',
      /** 开发时将 Express 路由注入 Vite dev server，单进程启动 */
      configureServer(server) {
        const { app } = createApp();
        server.middlewares.use(app);
      },
    },
  ],
  server: {
    port: 5173,
  },
});
