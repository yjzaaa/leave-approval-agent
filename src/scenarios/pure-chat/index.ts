/**
 * 纯聊天场景 — 无 tool、无表单、无 HITL
 *
 * 演示最简单的场景形态：只需要 prompt + 空 tools。
 * 适合智能助手、客服 Bot、闲聊等场景。
 */
import type { Scenario } from '../../domain/interfaces/IScenario.js';

const systemPrompt = `你是一个友好、专业的智能助手。你的任务是：

1. 用简洁清晰的语言回答用户的问题
2. 如果不确定答案，坦诚告知
3. 可以进行日常闲聊，保持友好语气
4. 不要编造信息，如果不知道就说不知道

对话风格：
- 简洁为主，避免冗长
- 可以适当使用 emoji 增加亲和力
- 中文回复`;

export const pureChatScenario: Scenario = {
  id: 'pure_chat',
  displayName: '智能助手',
  systemPrompt,
  tools: [],                      // 无 tool — 纯对话
  confirmTools: [],               // 无 HITL
  suggestions: [
    '你好，今天天气怎么样？',
    '帮我写一封请假邮件',
    '解释一下什么是微服务架构',
  ],
};