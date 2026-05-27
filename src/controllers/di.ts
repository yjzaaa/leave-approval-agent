/**
 * Controller 层依赖注册
 *
 * 注册 chatService / compactService / memoryService。
 * 依赖: startAgent / scenarioResolver / tracerFactory / sessionStore / modelProvider
 */
import type { Plugin } from '../infrastructure/di/context.js';
import type { AgentRunner } from '../agent/di.js';
import type { ScenarioResolver } from '../models/scenarios/di.js';
import type { TracerFactory, HitlSessionStore } from '../infrastructure/di/index.js';
import type { Scenario } from '../models/domain/interfaces/IScenario.js';
import type { ChatMessage } from '../models/domain/models/ChatMessage.js';
import type { MemoryItem } from '../models/domain/models/MemoryItem.js';
import type { SSECallback } from '../models/domain/interfaces/ISSE.js';

/** 对话服务 — 编排 Agent 运行生命周期 */
export interface ChatService {
  run(params: {
    scenario: Scenario;
    message: string;
    history?: ChatMessage[];
    memories?: MemoryItem[];
    summary?: string;
    sessionId: string;
    userId?: string;
    onSSE: SSECallback;
  }): Promise<void>;
}

export const registerControllers: Plugin = (ctx) => {
  ctx.singleton<ChatService>('chatService', (c) => {
    const startAgent = c.get<AgentRunner>('startAgent');
    const tracerFactory = c.get<TracerFactory>('tracerFactory');
    const sessionStore = c.get<HitlSessionStore>('sessionStore');

    return {
      async run({ scenario, message, history, memories, summary, sessionId, userId, onSSE }) {
        const tracer = await tracerFactory({
          scenario: scenario.id,
          userId,
          sessionId,
          message,
        });

        const run = startAgent({
          scenario,
          message,
          history,
          memories,
          summary,
          onSSE,
          tracer,
        });

        sessionStore.set(sessionId, run.hitl);

        await tracer.run(async () => {
          await run.completed;
        });
      },
    };
  });
};
