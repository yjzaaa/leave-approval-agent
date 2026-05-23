/**
 * Express Web 服务 — 插件化 SSE 流式 Agent
 *
 * 架构: 浏览器 → Express → Agent 框架 → 业务插件 → DeepSeek API
 *
 * 路由:
 *   POST /api/chat      — SSE 流式对话（注入默认插件）
 *   POST /api/confirm   — 用户确认/拒绝
 *   GET  /api/plugins   — 获取可用插件列表
 *
 * 与旧版区别：
 *   - 不再硬编码 tool 名称和字段标签，全部从 plugin 动态获取
 *   - agent-factory 负责 Agent 创建和 SSE 事件转换
 *   - server 只负责 HTTP 路由和 SSE 写入
 */
import fs from 'node:fs';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgent, getDefaultModel } from '../agent/agent-factory.js';
import { approveConfirm, rejectConfirm } from '../agent/confirm-state.js';
import { getPlugin, getDefaultPlugin, registry } from '../plugins/registry.js';
import type { ChatMessage } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// 开发: Vite dev server 独立运行; 生产: 从 dist/ 提供静态文件
const staticDir = path.join(__dirname, '..', 'dist');
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
  console.log('[Static] serving from dist/');
}

/** SSE 辅助：写入一条命名事件 */
function sendSSE(res: Response, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * POST /api/chat — SSE 流式对话（插件化）
 *
 * 支持通过 body.plugin 指定使用哪个业务插件，默认使用 leave_approval。
 * Agent 创建和事件转换全部委托给 agent-factory。
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history, plugin: pluginId } = req.body as {
    message?: string;
    history?: ChatMessage[];
    plugin?: string;
  };

  if (!message) return res.status(400).json({ error: 'message required' });

  // 根据请求选择插件
  const plugin = pluginId ? getPlugin(pluginId) : getDefaultPlugin();

  // 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    await runAgent({
      plugin,
      message,
      history,
      onSSE: (event, data) => sendSSE(res, event, data),
    });
  } catch (err: any) {
    sendSSE(res, 'error', { message: err.message || String(err) });
  } finally {
    res.end();
  }
});

/**
 * POST /api/confirm — 用户确认/拒绝
 */
app.post('/api/confirm', (req: Request, res: Response) => {
  const { approved } = req.body;
  if (approved) {
    const ok = approveConfirm();
    res.json({ ok, message: ok ? '已确认' : '无待确认请求' });
  } else {
    const ok = rejectConfirm();
    res.json({ ok, message: ok ? '已拒绝' : '无待确认请求' });
  }
});

/**
 * GET /api/plugins — 获取可用插件列表
 *
 * 前端可据此渲染插件选择器，或通过 URL 参数指定插件。
 */
app.get('/api/plugins', (_req: Request, res: Response) => {
  const list = Object.entries(registry).map(([id, p]) => ({
    id,
    displayName: p.displayName,
    fieldCount: p.fields.length,
  }));
  res.json({ plugins: list });
});

// ── 启动服务 ──
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  插件化审批 Agent (Web UI) v3.0              ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  地址: http://localhost:${PORT}                  ║`);
  console.log(`║  模型: ${getDefaultModel().name.padEnd(34)}║`);
  console.log(`║  插件: ${getDefaultPlugin().displayName.padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
