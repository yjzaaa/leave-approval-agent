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
      const { messages, scenario, existingLearnings } = req.body;

      const messagesText = messages
        .map((m: { role: string; content: unknown }) => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
        .join('\n');

      const existingBlock = existingLearnings && existingLearnings.length > 0
        ? `\n已有经验（请在此基础上迭代更新 — 合并相似条目、修正矛盾、删除过时、补充新知）:\n${existingLearnings.map((l: string) => `- ${l}`).join('\n')}`
        : '';

      const extractPrompt = `分析以下对话，提取用户记忆。当前场景: ${scenario || '未知'}。返回 JSON 格式，严格按照以下结构:
{
  "user": ["用户姓名/职位/部门等信息"],
  "feedback": ["用户表达的偏好/纠正/确认"],
  "project": ["业务上下文/进行中的工作"],
  "reference": ["外部资源/链接/系统名称"],
  "learnings": ["领域知识沉淀"]
}

规则:
- 每条记忆不超过 50 字，只提取确定事实
- 某类无新信息则返回空数组

⚠️ learnings 使用以下结构化格式:
- [纠正] 内容 — 用户纠正过的错误做法 → 正确做法
- [方法] 内容 — 验证成功的操作步骤或计算规则
- [陷阱] 内容 — 常见错误或易踩的坑
- [注意] 内容 — 系统性注意事项（类型差异、命名约定、限制条件）
- 宁缺毋滥：有明确证据（用户纠正/确认/警告）的才提取，仅凭"助手成功执行"推断的不要提取
${existingBlock}
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
        const parsed: ExtractMemoriesResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { user: [], feedback: [], project: [], reference: [], learnings: [] };
        res.json(parsed);
      } catch {
        const empty: ExtractMemoriesResponse = { user: [], feedback: [], project: [], reference: [], learnings: [] };
        res.json(empty);
      }
    } catch (err: unknown) {
      const errorResp: ApiErrorResponse = { error: err instanceof Error ? err.message : String(err) };
      res.status(500).json(errorResp);
    }
  });

  return router;
}
