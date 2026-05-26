/**
 * 浏览器端工具函数 — 替代 /api/compact 和 /api/extract-memories
 *
 * 在浏览器环境中直接创建 mini Agent 执行摘要和记忆提取，
 * 无 HTTP 往返，复用同一组 pi-agent / pi-ai 依赖。
 */
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import { getModel } from '../model/index.js';

/** 对话压缩 — 返回摘要文本 */
export async function compactHistoryLocal(messages: Array<{ role: string; content: string }>): Promise<string> {
  const messagesText = messages
    .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n');

  const compactPrompt = `请将以下对话历史压缩为一段简洁的摘要，保留关键信息（用户身份、操作、结果、偏好）。用中文回复，不超过 300 字。

对话记录:
${messagesText}`;

  const model = getModel('utility');

  let summary = '';
  const agent = new Agent({
    initialState: {
      systemPrompt: '你是一个对话摘要助手。只输出摘要文本，不要多余解释。',
      tools: [],
      model,
      messages: [],
    },
    streamFn: streamSimple,
  });

  agent.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
      summary += event.assistantMessageEvent.delta;
    }
  });

  await agent.prompt(compactPrompt);
  await agent.waitForIdle();

  return summary.trim();
}

/** 记忆提取 — 从对话中提取结构化记忆 */
export async function extractMemoriesLocal(messages: Array<{ role: string; content: string }>): Promise<{
  user: string[];
  feedback: string[];
  project: string[];
  reference: string[];
}> {
  const messagesText = messages
    .map(m => `${m.role === 'user' ? '用户' : '助手'}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`)
    .join('\n');

  const extractPrompt = `分析以下对话，提取用户记忆。返回 JSON 格式，严格按照以下结构:
{
  "user": ["用户姓名/职位/部门等信息"],
  "feedback": ["用户表达的偏好/纠正/确认"],
  "project": ["业务上下文/进行中的工作"],
  "reference": ["外部资源/链接/系统名称"]
}

规则:
- 每条记忆是一句简洁的话，不超过 50 字
- 只提取确定的事实，不要推测
- 如果某类没有新信息，返回空数组
- 不要重复已有信息

对话记录:
${messagesText}`;

  const model = getModel('utility');

  let result = '';
  const agent = new Agent({
    initialState: {
      systemPrompt: '你是记忆提取助手。只输出 JSON，不要解释。',
      tools: [],
      model,
      messages: [],
    },
    streamFn: streamSimple,
  });

  agent.subscribe((event) => {
    if (event.type === 'message_update' && event.assistantMessageEvent?.type === 'text_delta') {
      result += event.assistantMessageEvent.delta;
    }
  });

  await agent.prompt(extractPrompt);
  await agent.waitForIdle();

  try {
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { user: [], feedback: [], project: [], reference: [] };
  } catch {
    return { user: [], feedback: [], project: [], reference: [] };
  }
}
