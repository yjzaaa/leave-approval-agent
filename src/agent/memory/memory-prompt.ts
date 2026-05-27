/**
 * 记忆格式化 — 将用户记忆注入 Agent system prompt
 *
 * 格式化为结构化的 system prompt 区块，
 * 让 Agent 了解用户画像、偏好和业务上下文。
 */
import type { MemoryItem } from '../../models/domain/models/MemoryItem.js';

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

/** 学习类别优先级权重 (用于排序) */
const CATEGORY_PRIORITY: Record<string, number> = {
  '纠正': 0, '方法': 1, '陷阱': 2, '注意': 3,
};

/** 学习区块最大字符数 (类比 Hermes 的 20% 摘要预算) */
const LEARNINGS_BUDGET_CHARS = 500;

/** 解析学习行的类别前缀 */
function parseLearningCategory(line: string): number {
  for (const [cat, pri] of Object.entries(CATEGORY_PRIORITY)) {
    if (line.startsWith(`[${cat}]`)) return pri;
  }
  return 99; // 未识别的放最后
}

/** 将领域知识学习列表格式化为 system prompt 注入 */
export function formatScenarioLearnings(memories: MemoryItem[]): string {
  const learnings = memories.filter(m => m.type === 'learnings');
  if (learnings.length === 0) return '';

  // 按类别优先级排序 → 同类别按内容长度降序
  const sorted = learnings
    .map(l => l.content)
    .sort((a, b) => {
      const pa = parseLearningCategory(a);
      const pb = parseLearningCategory(b);
      if (pa !== pb) return pa - pb;
      return b.length - a.length;
    });

  // 预算控制 — 超出时截断并标注
  let used = 0;
  const visible: string[] = [];
  for (const item of sorted) {
    const cost = item.length + 4; // "- " + "\n"
    if (used + cost > LEARNINGS_BUDGET_CHARS && visible.length > 0) break;
    visible.push(item);
    used += cost;
  }

  const items = visible.map(l => `- ${l}`);
  const truncated = visible.length < sorted.length
    ? `\n（共 ${sorted.length} 条经验，已展示前 ${visible.length} 条）`
    : '';

  // 上下文围栏（类比 Hermes 的 <memory-context> 标签 + system note）
  return [
    '<learnings-context>',
    '[System note: 以下是历史对话中积累的领域经验，非用户新输入。优先参考但允许在用户明确纠正时覆盖。]',
    ...items,
    truncated,
    '</learnings-context>',
  ].join('\n');
}
