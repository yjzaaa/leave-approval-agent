/**
 * Express Web 服务 — 场景化 SSE 流式 Agent
 *
 * 架构: 浏览器 → Express → Agent 框架 → 业务场景 → DeepSeek API
 *
 * 路由:
 *   POST /api/chat      — SSE 流式对话（注入默认场景）
 *   POST /api/confirm   — 用户确认/拒绝
 *   GET  /api/scenarios — 获取可用场景列表
 *
 * 与旧版区别：
 *   - 不再硬编码 tool 名称和字段标签，全部从 scenario 动态获取
 *   - agent-factory 负责 Agent 创建和 SSE 事件转换
 *   - server 只负责 HTTP 路由和 SSE 写入
 */
import fs from 'node:fs';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runAgent, getDefaultModel } from '../agent/core/agent-factory.js';
import { createTracer } from '../agent/tracing/mlflow-tracer.js';
import type { HitlManager } from '../agent/hitl/hitl.js';
import { getScenario, getDefaultScenario, registry } from '../scenarios/registry.js';
import type { ChatMessage } from '../domain/models/ChatMessage.js';
import type { MemoryItem } from '../domain/models/MemoryItem.js';
import type { CompactResponse, ExtractMemoriesResponse, ConfirmResponse, ApiErrorResponse } from '../domain/dto/ApiResponses.js';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple, getModel } from '@earendil-works/pi-ai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

/** sessionId → HitlManager 映射（支持并发会话） */
const hitlSessions = new Map<string, HitlManager>();

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
 * POST /api/chat — SSE 流式对话（场景化）
 *
 * 支持通过 body.scenario 指定使用哪个业务场景，默认使用 leave_approval。
 * Agent 创建和事件转换全部委托给 agent-factory。
 */
/** 对话压缩 — 前端一次性调用，服务端不存储 */
app.post('/api/compact', express.json(), async (req, res) => {
  try {
    const { messages, scenario: scenarioId } = req.body;
    const scenario = getScenario(scenarioId || 'leave_approval');

    // 构建压缩 prompt
    const messagesText = messages
      .map((m: { role: string; content: unknown }) => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
      .join('\n');

    const compactPrompt = `请将以下对话历史压缩为一段简洁的摘要，保留关键信息（用户身份、操作、结果、偏好）。用中文回复，不超过 300 字。

对话记录:
${messagesText}`;

    // 直接调用模型生成摘要（不走 Agent）
        const model = getModel('deepseek', 'deepseek-v4-pro' as Parameters<typeof getModel>[1]);
        
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

    agent.subscribe((event) => {
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        summary += event.assistantMessageEvent.delta;
      }
    });

    await agent.prompt(compactPrompt);
    await agent.waitForIdle();

    const result: CompactResponse = { summary: summary.trim() };
    res.json(result);
  } catch (err: unknown) {
    const errorResp: ApiErrorResponse = { error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(errorResp);
  }
});

/** 记忆提取 — 从对话中提取用户记忆，一次性返回不存储 */
app.post('/api/extract-memories', express.json(), async (req, res) => {
  try {
    const { messages, scenario: scenarioId } = req.body;

    const messagesText = messages
      .map((m: { role: string; content: unknown }) => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
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

            const model = getModel('deepseek', 'deepseek-v4-pro' as Parameters<typeof getModel>[1]);
    
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

    agent.subscribe((event) => {
      if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
        result += event.assistantMessageEvent.delta;
      }
    });

    await agent.prompt(extractPrompt);
    await agent.waitForIdle();

    // 尝试解析 JSON
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      const parsed: ExtractMemoriesResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { user: [], feedback: [], project: [], reference: [] };
      res.json(parsed);
    } catch {
      const empty: ExtractMemoriesResponse = { user: [], feedback: [], project: [], reference: [] };
      res.json(empty);
    }
  } catch (err: unknown) {
    const errorResp: ApiErrorResponse = { error: err instanceof Error ? err.message : String(err) };
    res.status(500).json(errorResp);
  }
});
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history, scenario: scenarioId, memories, summary, sessionId, userId } = req.body as {
    message?: string;
    history?: ChatMessage[];
    scenario?: string;
    memories?: MemoryItem[];
    summary?: string;
    sessionId?: string;
    userId?: string;
  };

  const resolvedSessionId = sessionId || 'default';

  if (!message) {
    const badReq: ApiErrorResponse = { error: 'message required' };
    return res.status(400).json(badReq);
  }

  // 根据请求选择场景
  const scenario = scenarioId ? getScenario(scenarioId) : getDefaultScenario();

  // 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  try {
    const tracer = createTracer({
      scenario: scenario.id,
      userId,
      sessionId: resolvedSessionId,
      message,
    });

    await tracer.run(async () => {
      await runAgent({
        scenario,
        message,
        history,
        memories,
        summary,
        onSSE: (event, data) => sendSSE(res, event, data),
        tracer,
        onHitlCreated: (hitl) => { hitlSessions.set(resolvedSessionId, hitl); },
      });
    });
  } catch (err: unknown) {
    sendSSE(res, 'error', { message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
});

/**
 * POST /api/confirm — 用户确认/拒绝
 */
app.post('/api/confirm', (req: Request, res: Response) => {
  const { approved, sessionId } = req.body;
  const hitl = hitlSessions.get(sessionId || 'default');
  if (!hitl) {
    const noSession: ConfirmResponse = { ok: false, message: '无活跃会话' };
    res.json(noSession);
    return;
  }
  if (approved) {
    const ok = hitl.approve();
    const result: ConfirmResponse = { ok, message: ok ? '已确认' : '无待确认请求' };
    res.json(result);
  } else {
    const ok = hitl.reject();
    const result: ConfirmResponse = { ok, message: ok ? '已拒绝' : '无待确认请求' };
    res.json(result);
  }
});

/**
 * GET /api/scenarios — 获取可用场景列表
 *
 * 前端可据此渲染场景选择器，或通过 URL 参数指定场景。
 */
app.get('/api/scenarios', (_req: Request, res: Response) => {
  const list = Object.entries(registry).map(([id, p]) => ({
    id,
    displayName: p.displayName,
    fieldCount: p.fields?.length || 0,
    suggestions: p.suggestions || [],
  }));
  res.json({ scenarios: list });
});

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
