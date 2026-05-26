/**
 * 路由 — POST /api/chat SSE 流式对话（场景化）
 *
 * 支持通过 body.scenario 指定使用哪个业务场景，默认使用 leave_approval。
 * Agent 创建和事件转换全部委托给 agent-factory。
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { runAgent } from '../../../agent/core/agent-factory.js';
import { createTracer } from '../../../agent/tracing/mlflow-tracer.js';
import type { HitlManager } from '../../../agent/hitl/hitl.js';
import { getScenario, getDefaultScenario } from '../../../models/scenarios/registry.js';
import type { ChatMessage } from '../../../models/domain/models/ChatMessage.js';
import type { MemoryItem } from '../../../models/domain/models/MemoryItem.js';
import type { ApiErrorResponse } from '../../../models/domain/dto/ApiResponses.js';

/** SSE 辅助：写入一条命名事件 */
function sendSSE(res: Response, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/**
 * 创建 chat 路由
 * @param hitlSessions sessionId → HitlManager 映射（支持并发会话）
 */
export function createChatRouter(hitlSessions: Map<string, HitlManager>): Router {
  const router = Router();

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

  return router;
}
