/**
 * AgentEventBus — IAgentEventBus 的 EventEmitter 实现
 *
 * 封装 Node EventEmitter，提供类型安全的 emit/on。
 * 每个 HTTP 请求创建一个新实例，请求结束时 destroy()。
 */
import { EventEmitter } from 'node:events';
import type { IAgentEventBus, AgentEventMap } from '../../models/domain/interfaces/IEventBus.js';

export class AgentEventBus implements IAgentEventBus {
  private emitter = new EventEmitter();

  emit<K extends keyof AgentEventMap>(event: K, data: AgentEventMap[K]): void {
    this.emitter.emit(event as string, data);
  }

  on<K extends keyof AgentEventMap>(event: K, handler: (data: AgentEventMap[K]) => void): () => void {
    this.emitter.on(event as string, handler);
    return () => { this.emitter.off(event as string, handler); };
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}
