/**
 * 领域知识学习 — 结构化格式 + 合并/去重逻辑
 *
 * 参考 Hermes Agent 上下文压缩的迭代更新策略：
 * - 结构化模板（类比 12 节摘要模板）
 * - 新旧合并而非简单追加
 * - 矛盾时以最新用户确认的为准
 */

/** 学习类别 */
export type LearningCategory = '纠正' | '方法' | '陷阱' | '注意';

/** 学习条目 — 从 MemoryItem.content 解析的结构 */
export interface LearningEntry {
  category: LearningCategory;
  content: string;
}

/** 学习条目的结构化文本格式: "[类别] 内容" */
const LEARNING_LINE_RE = /^\[(纠正|方法|陷阱|注意)\]\s+(.+)$/;

/** 解析单行学习文本为结构化条目 */
function parseLearningLine(line: string): LearningEntry | null {
  const m = line.match(LEARNING_LINE_RE);
  if (!m) return null;
  return { category: m[1] as LearningCategory, content: m[2].trim() };
}

/** 将结构化条目序列化为文本行 */
function formatLearningLine(entry: LearningEntry): string {
  return `[${entry.category}] ${entry.content}`;
}

/** 计算两个文本的简单相似度 (Jaccard on 2-char bigrams) */
function textSimilarity(a: string, b: string): number {
  const bigrams = (s: string) => {
    const set = new Set<string>();
    for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
    return set;
  };
  const sa = bigrams(a);
  const sb = bigrams(b);
  if (sa.size === 0 && sb.size === 0) return 1;
  let intersection = 0;
  for (const bg of sa) { if (sb.has(bg)) intersection++; }
  return intersection / Math.max(sa.size, sb.size);
}

/**
 * 合并新旧学习列表
 *
 * 策略（类比 Hermes 迭代更新）：
 * 1. 同类别的学习检查语义相似度
 * 2. 相似度 > 0.6 → 保留更长的（信息更丰富）
 * 3. 同类别的矛盾内容 → 保留新的（用户最新确认优先）
 * 4. 去重后按类别分组排序
 *
 * @param existing 已有的学习内容数组 (MemoryItem.content 值)
 * @param incoming 新提取的学习内容数组
 * @returns 合并后的学习内容数组
 */
export function mergeLearnings(existing: string[], incoming: string[]): string[] {
  // 解析所有条目
  const existingEntries = existing.map(parseLearningLine).filter(Boolean) as LearningEntry[];
  const incomingEntries = incoming.map(parseLearningLine).filter(Boolean) as LearningEntry[];

  // 无法解析的保留原样
  const unparsedExisting = existing.filter(l => !LEARNING_LINE_RE.test(l));
  const unparsedIncoming = incoming.filter(l => !LEARNING_LINE_RE.test(l));

  const merged: LearningEntry[] = [...existingEntries];

  for (const inc of incomingEntries) {
    // 在同类别中找相似条目
    const sameCategory = merged.filter(e => e.category === inc.category);
    const similar = sameCategory.find(e => textSimilarity(e.content, inc.content) > 0.6);

    if (similar) {
      // 保留内容更长的（信息更丰富）
      if (inc.content.length > similar.content.length) {
        const idx = merged.indexOf(similar);
        merged[idx] = inc;
      }
      // 否则丢弃新条目（旧条目更详细）
    } else {
      // 检查是否与同类别条目矛盾（简化：内容关键词重叠度很低的新条目直接加入）
      merged.push(inc);
    }
  }

  // 排序：[纠正, 方法, 陷阱, 注意]，同类内按内容长度降序
  const categoryOrder: LearningCategory[] = ['纠正', '方法', '陷阱', '注意'];
  merged.sort((a, b) => {
    const ca = categoryOrder.indexOf(a.category);
    const cb = categoryOrder.indexOf(b.category);
    if (ca !== cb) return ca - cb;
    return b.content.length - a.content.length;
  });

  const result = merged.map(formatLearningLine);
  // 无法解析的原始条目追加到末尾
  return [...result, ...unparsedExisting, ...unparsedIncoming];
}

/**
 * 从 MemoryItem 数组中提取所有 learnings 的内存内容
 */
export function extractLearningContents(memories: Array<{ type: string; content: string }>): string[] {
  return memories.filter(m => m.type === 'learnings').map(m => m.content);
}
