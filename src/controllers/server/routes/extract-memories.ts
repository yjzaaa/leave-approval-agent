/**
 * 路由 — POST /api/extract-memories 记忆提取
 */
import { Router } from 'express';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import type { AppContext } from '../../../infrastructure/di/context.js';
import type { ModelProvider } from '../../../infrastructure/di/index.js';
import type { ExtractMemoriesResponse, ApiErrorResponse } from '../../../models/domain/dto/ApiResponses.js';

/** 创建 extract-memories 路由 — 从 ctx 解析依赖 */
export function createExtractMemoriesRouter(ctx: AppContext): Router {
  const router = Router();
  const modelProvider = ctx.get<ModelProvider>('modelProvider');

  router.post('/extract-memories', async (req, res) => {
    try {
      const { messages } = req.body;

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

      const model = modelProvider('utility');

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

  return router;
}
