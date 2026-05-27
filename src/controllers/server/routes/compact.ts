/**
 * 路由 — POST /api/compact 对话压缩
 */
import { Router } from 'express';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import type { AppContext } from '../../../infrastructure/di/context.js';
import type { ModelProvider } from '../../../infrastructure/di/index.js';
import type { ScenarioResolver } from '../../../models/scenarios/di.js';
import type { CompactResponse, ApiErrorResponse } from '../../../models/domain/dto/ApiResponses.js';

/** 创建 compact 路由 — 从 ctx 解析依赖 */
export function createCompactRouter(ctx: AppContext): Router {
  const router = Router();
  const modelProvider = ctx.get<ModelProvider>('modelProvider');
  const scenarioResolver = ctx.get<ScenarioResolver>('scenarioResolver');

  router.post('/compact', async (req, res) => {
    try {
      const { messages, scenario: scenarioId } = req.body;
      const scenario = scenarioId ? scenarioResolver.getScenario(scenarioId) : scenarioResolver.getDefaultScenario();

      const messagesText = messages
        .map((m: { role: string; content: unknown }) => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
        .join('\n');

      const compactPrompt = `请将以下对话历史压缩为一段简洁的摘要，保留关键信息（用户身份、操作、结果、偏好）。用中文回复，不超过 300 字。

对话记录:
${messagesText}`;

      const model = modelProvider('utility');

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

  return router;
}
