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

    const scenario = scenarioId ? scenarioResolver.getScenario(scenarioId) : scenarioResolver.getDefaultScenario();

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    try {
      await chatService.run({
        scenario,
        message,
        history,
        memories,
        summary,
        sessionId: resolvedSessionId,
        userId,
        onSSE: (event, data) => sendSSE(res, event, data),
      });
    } catch (err: unknown) {
      sendSSE(res, 'error', { message: err instanceof Error ? err.message : String(err) });
    } finally {
      res.end();
    }
  });

  return router;
}
