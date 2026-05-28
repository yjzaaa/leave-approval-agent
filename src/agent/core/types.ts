/**
 * Agent 框架层类型定义
 *
 * 与具体业务无关的通用类型。
 * 业务特定类型定义在 domain/interfaces/ 和各 scenario 中。
 */
import type { Scenario } from '../../models/domain/interfaces/IScenario.js';
import type { IAgentEventBus } from '../../models/domain/interfaces/IEventBus.js';

// 重导出 domain 中的 SSECallback，保持向后兼容
export type { SSECallback } from '../../models/domain/interfaces/ISSE.js';

/** Agent 创建参数 */
export interface CreateAgentParams {
  scenario: Scenario;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}
