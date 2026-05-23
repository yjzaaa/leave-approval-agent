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

export const registry: PluginRegistry = {
  leave_approval: leavePlugin,
  expense_approval: expensePlugin,
  sick_leave: sickLeavePlugin,
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
