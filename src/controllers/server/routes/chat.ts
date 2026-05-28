/**
 * 路由 — POST /api/chat SSE 流式对话（场景化）
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { AppContext } from '../../../infrastructure/di/context.js';
import type { IChatService } from '../../di.js';
import type { ScenarioResolver } from '../../../models/scenarios/di.js';
import type { ChatMessage } from '../../../models/domain/models/ChatMessage.js';
import type { MemoryItem } from '../../../models/domain/models/MemoryItem.js';
import type { ApiErrorResponse } from '../../../models/domain/dto/ApiResponses.js';
import { AgentEventBus } from '../../../agent/events/index.js';

/** SSE 辅助：写入一条命名事件 */
function sendSSE(res: Response, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** 创建 chat 路由 — 从 ctx 解析依赖 */
export function createChatRouter(ctx: AppContext): Router {
  const router = Router();
  const chatService = ctx.get<IChatService>('chatService');
  const scenarioResolver = ctx.get<ScenarioResolver>('scenarioResolver');

  router.post('/chat', async (req: Request, res: Response) => {
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

    // 场景 ID 规范化：连字符 → 下划线，避免 finance-query vs finance_query 不匹配
    const normalizedId = scenarioId?.replace(/-/g, '_');

    let scenario;
    try {
      scenario = normalizedId ? scenarioResolver.getScenario(normalizedId) : scenarioResolver.getDefaultScenario();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return res.status(400).json({ error: msg } as ApiErrorResponse);
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const eventBus = new AgentEventBus();

    // 订阅事件 → SSE 写入
    eventBus.on('text', (data) => sendSSE(res, 'text', data));
    eventBus.on('tool_result', (data) => sendSSE(res, 'tool_result', data));
    eventBus.on('content', (data) => sendSSE(res, 'content', data));
    eventBus.on('confirm_required', (data) => sendSSE(res, 'confirm_required', data));
    eventBus.on('confirm_resolved', (data) => sendSSE(res, 'confirm_resolved', data));
    eventBus.on('done', () => { sendSSE(res, 'done', {}); eventBus.destroy(); });
    eventBus.on('error', (data) => { sendSSE(res, 'error', data); eventBus.destroy(); });

    try {
      await chatService.run({
        scenario,
        message,
        history,
        memories,
        summary,
        sessionId: resolvedSessionId,
        userId,
        eventBus,
      });
    } catch (err: unknown) {
      eventBus.emit('error', { message: err instanceof Error ? err.message : String(err) });
    } finally {
      res.end();
    }
  });

  return router;
}
