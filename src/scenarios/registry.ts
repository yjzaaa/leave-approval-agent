/**
 * 场景注册表
 *
 * 所有可用场景在此集中注册。
 * 通过 scenario ID 查找并注入 Agent 框架。
 */
import type { ScenarioRegistry } from '../shared/scenario.js';
import { leaveScenario } from './leave-approval/index.js';
import { expenseScenario } from './expense-approval/index.js';
import { sickLeaveScenario } from './sick-leave/index.js';
import { pureChatScenario } from './pure-chat/index.js';
import { faqScenario } from './faq/index.js';
import { oncallScenario } from './oncall/index.js';

export const registry: ScenarioRegistry = {
  // 审批类 (两步 HITL)
  leave_approval: leaveScenario,
  expense_approval: expenseScenario,
  sick_leave: sickLeaveScenario,
  // 纯聊天 (无 tool、无 HITL)
  pure_chat: pureChatScenario,
  // FAQ 咨询 (有 tool、无 HITL)
  faq: faqScenario,
  // 值班排班 (查询无 HITL + 换班单步 HITL)
  oncall: oncallScenario,
};

/** 根据 ID 获取场景 */
export function getScenario(id: string) {
  const scenario = registry[id];
  if (!scenario) {
    throw new Error(`未找到场景: ${id}。可用场景: ${Object.keys(registry).join(', ')}`);
  }
  return scenario;
}

/** 获取默认场景 */
export function getDefaultScenario() {
  return leaveScenario;
}