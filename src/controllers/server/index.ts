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
 */
import fs from 'node:fs';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDefaultModel } from '../../agent/core/agent-factory.js';
import { getDefaultScenario } from '../../models/scenarios/registry.js';
import type { HitlManager } from '../../agent/hitl/hitl.js';
import {
  createChatRouter,
  createConfirmRouter,
  createCompactRouter,
  createExtractMemoriesRouter,
  createScenariosRouter,
} from './routes/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

/** sessionId → HitlManager 映射（支持并发会话） */
const hitlSessions = new Map<string, HitlManager>();

app.use(express.json());

// ── 挂载路由 ──
app.use('/api', createChatRouter(hitlSessions));
app.use('/api', createConfirmRouter(hitlSessions));
app.use('/api', createCompactRouter());
app.use('/api', createExtractMemoriesRouter());
app.use('/api', createScenariosRouter());

// ── 静态文件服务 ──
// 开发: Vite dev server 独立运行; 生产: 从 dist/ 提供静态文件
const staticDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  console.log('[Static] serving from dist/');
}

// ── 启动服务 ──
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  场景化审批 Agent (Web UI) v3.0              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  地址: http://localhost:${PORT}                  ║`);
  console.log(`║  模型: ${getDefaultModel().name.padEnd(34)}║`);
  console.log(`║  场景: ${getDefaultScenario().displayName.padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
