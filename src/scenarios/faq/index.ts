/**
 * FAQ 咨询场景 — 只有检索 tool，无 HITL
 *
 * 演示咨询类业务：有 tool 但不需要确认。
 * 适合知识库问答、HR 咨询、IT 支持等场景。
 */
import type { Scenario } from '../../shared/scenario.js';
import { allFaqTools } from './tools.js';

const systemPrompt = `你是公司内部政策咨询助手。你的职责是：

1. 回答员工关于公司政策、制度、流程的问题
2. 使用 search_knowledge_base 工具检索相关信息
3. 根据检索结果给出准确、清晰的回答
4. 如果知识库中没有相关信息，坦诚告知并建议联系 HR

注意事项：
- 优先使用工具检索，不要凭记忆回答
- 回答要引用具体政策条款
- 保持专业友好的语气`;

export const faqScenario: Scenario = {
  id: 'faq',
  displayName: '政策咨询',
  systemPrompt,
  tools: allFaqTools,             // 只有 search_knowledge_base
  confirmTools: [],               // 无 HITL — 查询直接返回
  suggestions: [
    '公司年假有多少天？',
    '报销流程是什么？',
    '加班怎么算？',
  ],
};