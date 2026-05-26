/**
 * Express Web 服务 — 场景化 SSE 流式 Agent
 *
 * 架构: 浏览器 → Express → Agent 框架 → 业务场景 → DeepSeek API
 *
 * 路由拆分到 routes/ 目录:
 *   routes/chat.ts            — POST /api/chat SSE 流式对话
 *   routes/confirm.ts         — POST /api/confirm 用户确认/拒绝
 *   routes/compact.ts         — POST /api/compact 对话压缩
 *   routes/extract-memories.ts — POST /api/extract-memories 记忆提取
 *   routes/scenarios.ts       — GET /api/scenarios 场景列表
 *
 * 开发模式: Vite configureServer 钩子内嵌调用 createApp()
 * 生产模式: 通过 cli.ts 独立运行，Express 伺服 dist/ 静态文件
 */
import fs from 'node:fs';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HitlManager } from '../../agent/hitl/hitl.js';
import {
  createChatRouter,
  createConfirmRouter,
  createCompactRouter,
  createExtractMemoriesRouter,
  createScenariosRouter,
} from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Express 应用工厂 — 供 Vite configureServer 和 CLI 共用 */
export function createApp() {
  const app = express();
  /** sessionId → HitlManager 映射（支持并发会话） */
  const hitlSessions = new Map<string, HitlManager>();

  app.use(express.json());

  // ── 挂载路由 ──
  app.use('/api', createChatRouter(hitlSessions));
  app.use('/api', createConfirmRouter(hitlSessions));
  app.use('/api', createCompactRouter());
  app.use('/api', createExtractMemoriesRouter());
  app.use('/api', createScenariosRouter());

  // ── 生产模式: 伺服 dist/ 静态文件 ──
  const staticDir = path.join(__dirname, '..', '..', 'dist');
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    console.log('[Static] serving from dist/');
  }

  return { app, hitlSessions };
}
