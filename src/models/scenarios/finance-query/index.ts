/**
 * 财务问数系统场景
 *
 * 支持通过自然语言查询 Excel 财务数据，生成报表和图表。
 * 11 个 Tool 分 4 层: 连接 → 查询 → 计算 → 输出。
 */
import type { Scenario } from '../../domain/interfaces/IScenario.js';
import { ExcelDataSource } from '../../../infrastructure/datasource/index.js';
import { createFinanceQueryTools } from './tools.js';
import { financeQueryPrompt } from './prompt.js';

/** 创建 dataSource 实例（可替换为其他 IDataSource 实现） */
const dataSource = new ExcelDataSource();

/** 财务问数场景 */
export const financeQueryScenario: Scenario = {
  id: 'finance_query',
  displayName: '财务问数',
  systemPrompt: financeQueryPrompt,
  tools: createFinanceQueryTools(dataSource),
  suggestions: [
    '查询 2025 年 IT 部门成本分配',
    '对比各部门近两年费用变化',
    '分析项目成本分摊率并生成饼图',
  ],
};
