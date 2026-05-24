/**
 * 值班排班场景 — 查询无 HITL + 换班单步 HITL
 *
 * 演示混合模式：查询类 tool 无需确认，操作类 tool 需要单步确认。
 * 适合排班查询、换班申请等场景。
 */
import type { Scenario } from '../../shared/scenario.js';
import { allOncallTools } from './tools.js';

const systemPrompt = `你是公司值班排班管理助手。你的职责是：

1. 帮助员工查询值班排班信息
2. 协助提交换班申请
3. 回答排班相关问题

工作流程：
- 先用 get_current_date 获取当前日期
- 查询排班使用 oncall_query
- 换班申请使用 oncall_swap（需要用户确认）

注意事项：
- 查询排班不需要确认，直接查询
- 换班申请需要确认后才能提交
- 确认前向用户展示完整信息`;

export const oncallScenario: Scenario = {
  id: 'oncall',
  displayName: '值班排班',
  systemPrompt,
  tools: allOncallTools,
  confirmTools: ['oncall_swap'],    // ★ 只有换班需要确认 — 单步 HITL
  confirmLabels: {
    oncall_swap: '🔄 确认换班申请',
  },
  suggestions: [
    '查询这周的值班安排',
    '我想换下周三的班',
    '今天谁值班？',
  ],
};