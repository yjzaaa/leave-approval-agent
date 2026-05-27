/**
 * 对话服务 — 消息路由、上下文构建、Agent 运行编排
 *
 * 依赖通过构造函数注入，不 import 任何具体实现。
 */
import type { AgentRunner } from '../../../agent/di.js';
import type { TracerFactory } from '../../../infrastructure/di/index.js';
import type { HitlSessionStore } from '../../../infrastructure/di/index.js';
import type { Scenario } from '../../../models/domain/interfaces/IScenario.js';
import type { ChatMessage } from '../../../models/domain/models/ChatMessage.js';
import type { MemoryItem } from '../../../models/domain/models/MemoryItem.js';
import type { SSECallback } from '../../../models/domain/interfaces/ISSE.js';

/** 对话运行参数 */
export interface ChatRunParams {
  scenario: Scenario;
  message: string;
  history?: ChatMessage[];
  memories?: MemoryItem[];
  summary?: string;
  sessionId: string;
  userId?: string;
  onSSE: SSECallback;
}

/** 对话服务 — 编排一次完整的 Agent 对话 */
export class ChatService {
  constructor(
    private readonly startAgent: AgentRunner,
    private readonly tracerFactory: TracerFactory,
    private readonly sessionStore: HitlSessionStore,
  ) {}

  /** 运行一次 Agent 对话（SSE 流式） */
  async run(params: ChatRunParams): Promise<void> {
    const { scenario, message, history, memories, summary, sessionId, userId, onSSE } = params;

    const tracer = await this.tracerFactory({
      scenario: scenario.id,
      userId,
      sessionId,
      message,
    });

    const run = this.startAgent({
      scenario,
      message,
      history,
      memories,
      summary,
      onSSE,
      tracer,
    });

    this.sessionStore.set(sessionId, run.hitl);

    await tracer.run(async () => {
      await run.completed;
    });
  }
}
