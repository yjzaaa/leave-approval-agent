/**
 * FAQ 咨询场景 — Tool 定义
 *
 * 只有 search_knowledge_base 一个 tool，用于检索知识库。
 * 无 HITL，查询结果直接返回给用户。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';

/** 模拟知识库数据 */
const KNOWLEDGE_BASE: Record<string, string> = {
  '远程办公政策': '远程办公需提前申请，每次最长 30 天。需填写远程办公申请表，经直属上级审批后生效。远程办公期间需保持工作日在线。',
  '年假规定': '入职满 1 年享有 5 天年假，满 3 年 10 天，满 5 年 15 天。年假可分次使用，最小单位为半天。当年未使用的年假可累积至次年 Q1。',
  '报销流程': '费用发生后 30 天内提交报销申请。需上传发票照片，填写费用明细。差旅费需附行程单。审批周期约 3-5 个工作日。',
  '病假申请': '病假需在当天通知直属上级和 HR。3 天以上需提供医院诊断证明。病假期间基本工资照发，超过规定天数按公司制度扣减。',
  '加班制度': '工作日加班需提前申请，周末加班需部门负责人审批。加班可申请调休或加班费（平日 1.5 倍、周末 2 倍、节假日 3 倍）。',
  '考勤制度': '上班时间 9:00-18:00，午休 12:00-13:00。迟到 15 分钟内算正常，超过 15 分钟需补签。每月允许 2 次补签机会。',
  '试用期': '试用期 3 个月，期间享有正式员工同等福利。试用期考核由直属上级 + HR 共同评估。提前通过可申请转正。',
  '离职流程': '正式员工离职需提前 30 天书面通知，试用期员工提前 3 天。需完成交接清单，归还公司资产，最后由 HR 办理手续。',
};

/** 检索知识库 Tool */
export const searchKnowledgeBaseTool: AgentTool = {
  name: 'search_knowledge_base',
  label: '检索知识库',
  description: '检索公司内部知识库，查找政策、流程、制度相关信息。输入关键词返回匹配结果。',
  parameters: Type.Object({
    query: Type.String({ description: '搜索关键词，如"年假""报销""加班"' }),
  }),
  execute: async (_id, params) => {
    const { query } = params as { query: string };
    const results: string[] = [];
    const lower = query.toLowerCase();

    for (const [key, value] of Object.entries(KNOWLEDGE_BASE)) {
      if (key.toLowerCase().includes(lower) || value.toLowerCase().includes(lower)) {
        results.push(`**${key}**: ${value}`);
      }
    }

    const text = results.length > 0
      ? `找到 ${results.length} 条相关结果：\n\n${results.join('\n\n')}`
      : `未找到与"${query}"相关的信息。建议换个关键词试试，如：年假、报销、加班、考勤等。`;

    return {
      content: [{ type: 'text' as const, text }],
      details: { query, resultCount: results.length },
    };
  },
};

export const allFaqTools = [searchKnowledgeBaseTool];