/**
 * Controller 层依赖注册
 *
 * 注册 chatService / compactService / memoryService。
 * 依赖: startAgent / scenarioResolver / tracerFactory / sessionStore / modelProvider
 */
import type { Plugin } from '../infrastructure/di/context.js';
import type { AgentRunner } from '../agent/di.js';
import type { TracerFactory, HitlSessionStore } from '../infrastructure/di/index.js';
import type { SSECallback } from '../models/domain/interfaces/ISSE.js';
import { ChatService } from './services/chat/index.js';
import type { ChatRunParams } from './services/chat/index.js';

/** 对话服务接口 — 编排 Agent 运行生命周期 */
export interface IChatService {
  run(params: ChatRunParams): Promise<void>;
}

export const registerControllers: Plugin = (ctx) => {
  ctx.singleton<IChatService>('chatService', (c) => {
    return new ChatService(
      c.get<AgentRunner>('startAgent'),
      c.get<TracerFactory>('tracerFactory'),
      c.get<HitlSessionStore>('sessionStore'),
    );
  });
};
