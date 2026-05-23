/**
 * 插件注册表
 *
 * 所有可用插件在此集中注册。
 * 通过 plugin ID 查找并注入 Agent 框架。
 */
import type { PluginRegistry } from '../shared/plugin.js';
import { leavePlugin } from './leave-approval/index.js';
import { expensePlugin } from './expense-approval/index.js';
import { sickLeavePlugin } from './sick-leave/index.js';
import { pureChatPlugin } from './pure-chat/index.js';
import { faqPlugin } from './faq/index.js';
import { oncallPlugin } from './oncall/index.js';

export const registry: PluginRegistry = {
  // 审批类 (两步 HITL)
  leave_approval: leavePlugin,
  expense_approval: expensePlugin,
  sick_leave: sickLeavePlugin,
  // 纯聊天 (无 tool、无 HITL)
  pure_chat: pureChatPlugin,
  // FAQ 咨询 (有 tool、无 HITL)
  faq: faqPlugin,
  // 值班排班 (查询无 HITL + 换班单步 HITL)
  oncall: oncallPlugin,
};

/** 根据 ID 获取插件 */
export function getPlugin(id: string) {
  const plugin = registry[id];
  if (!plugin) {
    throw new Error(`未找到插件: ${id}。可用插件: ${Object.keys(registry).join(', ')}`);
  }
  return plugin;
}

/** 获取默认插件 */
export function getDefaultPlugin() {
  return leavePlugin;
}