/**
 * 记忆格式化 — 将用户记忆注入 Agent system prompt
 *
 * 格式化为结构化的 system prompt 区块，
 * 让 Agent 了解用户画像、偏好和业务上下文。
 */
import type { MemoryItem } from '../../shared/memory.js';

/** 将记忆列表格式化为 system prompt 文本 */
export function formatMemoriesForPrompt(memories: MemoryItem[]): string {
  if (memories.length === 0) return '';

  const grouped: Record<string, string[]> = {
    user: [],
    feedback: [],
    project: [],
    reference: [],
  };

  for (const m of memories) {
    grouped[m.type]?.push(m.content);
  }

  const sections: string[] = [];

  if (grouped.user.length > 0) {
    sections.push(`## 用户信息\n${grouped.user.map(c => `- ${c}`).join('\n')}`);
  }

  if (grouped.feedback.length > 0) {
    sections.push(`## 用户偏好与反馈\n${grouped.feedback.map(c => `- ${c}`).join('\n')}`);
  }

  if (grouped.project.length > 0) {
    sections.push(`## 业务上下文\n${grouped.project.map(c => `- ${c}`).join('\n')}`);
  }

  if (grouped.reference.length > 0) {
    sections.push(`## 外部资源\n${grouped.reference.map(c => `- ${c}`).join('\n')}`);
  }

  return sections.length > 0
    ? `[用户记忆]\n以下是关于当前用户的已知信息，请据此调整回复方式:\n\n${sections.join('\n\n')}`
    : '';
}

/** 将对话摘要格式化为 history 注入 */
export function formatSummaryForHistory(summary: string): string {
  if (!summary) return '';
  return `[之前的对话摘要]\n${summary}`;
}
