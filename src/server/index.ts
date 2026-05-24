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
import { PiAgentTracer } from '../agent/mlflow-tracer.js';
import type { HitlManager } from '../agent/hitl.js';
import { getPlugin, getDefaultPlugin, registry } from '../plugins/registry.js';
import type { ChatMessage } from '../shared/types.js';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple, getModel } from '@earendil-works/pi-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

/** 当前活跃的 HITL 管理器（供 /api/confirm 路由使用） */
let activeHitl: HitlManager | null = null;

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
/** 对话压缩 — 前端一次性调用，服务端不存储 */
app.post('/api/compact', express.json(), async (req, res) => {
  try {
    const { messages, plugin: pluginId } = req.body;
    const plugin = getPlugin(pluginId || 'leave_approval');

    // 构建压缩 prompt
    const messagesText = messages
      .map((m: any) => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n');

    const compactPrompt = `请将以下对话历史压缩为一段简洁的摘要，保留关键信息（用户身份、操作、结果、偏好）。用中文回复，不超过 300 字。

对话记录:
${messagesText}`;

    // 直接调用模型生成摘要（不走 Agent）
        const model = getModel('deepseek', 'deepseek-v4-pro' as any);
        
    let summary = '';
    const agent = new Agent({
      initialState: {
        systemPrompt: '你是一个对话摘要助手。只输出摘要文本，不要多余解释。',
        tools: [],
        model,
        messages: [],
      },
      streamFn: streamSimple,
    });

    agent.subscribe((event: any) => {
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        summary += event.assistantMessageEvent.delta;
      }
    });

    await agent.prompt(compactPrompt);
    await agent.waitForIdle();

    res.json({ summary: summary.trim() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** 记忆提取 — 从对话中提取用户记忆，一次性返回不存储 */
app.post('/api/extract-memories', express.json(), async (req, res) => {
  try {
    const { messages, plugin: pluginId } = req.body;

    const messagesText = messages
      .map((m: any) => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n');

    const extractPrompt = `分析以下对话，提取用户记忆。返回 JSON 格式，严格按照以下结构:
{
  "user": ["用户姓名/职位/部门等信息"],
  "feedback": ["用户表达的偏好/纠正/确认"],
  "project": ["业务上下文/进行中的工作"],
  "reference": ["外部资源/链接/系统名称"]
}

规则:
- 每条记忆是一句简洁的话，不超过 50 字
- 只提取确定的事实，不要推测
- 如果某类没有新信息，返回空数组
- 不要重复已有信息

对话记录:
${messagesText}`;

            const model = getModel('deepseek', 'deepseek-v4-pro' as any);
    
    let result = '';
    const agent = new Agent({
      initialState: {
        systemPrompt: '你是记忆提取助手。只输出 JSON，不要解释。',
        tools: [],
        model,
        messages: [],
      },
      streamFn: streamSimple,
    });

    agent.subscribe((event: any) => {
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        result += event.assistantMessageEvent.delta;
      }
    });

    await agent.prompt(extractPrompt);
    await agent.waitForIdle();

    // 尝试解析 JSON
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      const memories = jsonMatch ? JSON.parse(jsonMatch[0]) : { user: [], feedback: [], project: [], reference: [] };
      res.json(memories);
    } catch {
      res.json({ user: [], feedback: [], project: [], reference: [] });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history, plugin: pluginId, memories, summary } = req.body as {
    message?: string;
    history?: ChatMessage[];
    plugin?: string;
    memories?: any[];
    summary?: string;
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
    const tracer = new PiAgentTracer({
      plugin: plugin.id,
      userId: (req.body as any).userId,
      sessionId: (req.body as any).sessionId,
      message,
    });

    await tracer.run(async () => {
      activeHitl = await runAgent({
        plugin,
        message,
        history,
        memories,
        summary,
        onSSE: (event, data) => sendSSE(res, event, data),
        tracer,
      });
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
  if (!activeHitl) {
    res.json({ ok: false, message: '无活跃会话' });
    return;
  }
  if (approved) {
    const ok = activeHitl.approve();
    res.json({ ok, message: ok ? '已确认' : '无待确认请求' });
  } else {
    const ok = activeHitl.reject();
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
    fieldCount: p.fields?.length || 0,
    suggestions: p.suggestions || [],
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
