/**
 * 领域知识学习系统 — 完整测试套件
 *
 * 覆盖:
 *   1. 结构化格式解析/序列化 (parseLearningLine / formatLearningLine)
 *   2. 合并去重 (mergeLearnings) — 去重/矛盾/排序/未解析条目
 *   3. 记忆提取 (extractLearningContents)
 *   4. 记忆存储 (getScenarioMemories 含 learnings)
 *   5. System Prompt 注入 (formatScenarioLearnings) — 排序/预算/截断/围栏
 */
import { describe, it, expect } from 'vitest';
import {
  parseLearningLine,
  formatLearningLine,
  mergeLearnings,
  extractLearningContents,
} from '../src/models/memory/learnings.js';
import { getScenarioMemories, createEmptyStore } from '../src/models/memory/store.js';
import { formatScenarioLearnings } from '../src/agent/memory/memory-prompt.js';
import type { MemoryItem, MemoryStore, ScenarioMemories } from '../src/models/domain/models/MemoryItem.js';

// ═══════════════════════════════════════════════════════════
// 1. 结构化格式解析/序列化
// ═══════════════════════════════════════════════════════════

describe('parseLearningLine', () => {
  it('解析 [纠正] 格式', () => {
    const r = parseLearningLine('[纠正] Function 应为 HR Allocation 而非 HR');
    expect(r).not.toBeNull();
    expect(r!.category).toBe('纠正');
    expect(r!.content).toBe('Function 应为 HR Allocation 而非 HR');
  });

  it('解析 [方法] 格式', () => {
    const r = parseLearningLine('[方法] 分摊公式: Amount × RateNo，所有 item 统一处理');
    expect(r).not.toBeNull();
    expect(r!.category).toBe('方法');
  });

  it('解析 [陷阱] 格式', () => {
    const r = parseLearningLine('[陷阱] 禁止 SUM(Year Total)，年值每行重复');
    expect(r).not.toBeNull();
    expect(r!.category).toBe('陷阱');
  });

  it('解析 [注意] 格式', () => {
    const r = parseLearningLine('[注意] Rate.CC 为数字，CC Mapping.CC 为字符串');
    expect(r).not.toBeNull();
    expect(r!.category).toBe('注意');
  });

  it('拒绝非结构化文本', () => {
    expect(parseLearningLine('分摊公式是 Amount × RateNo')).toBeNull();
    expect(parseLearningLine('')).toBeNull();
    expect(parseLearningLine('[其他] 未知类别')).toBeNull();
  });

  it('去掉内容前后空白', () => {
    const r = parseLearningLine('[方法]   两端有空格  ');
    expect(r!.content).toBe('两端有空格');
  });
});

describe('formatLearningLine', () => {
  it('序列化为标准格式', () => {
    const line = formatLearningLine({ category: '纠正', content: '正确的 Key 是 480055 Cycle' });
    expect(line).toBe('[纠正] 正确的 Key 是 480055 Cycle');
  });

  it('序列化/解析可逆', () => {
    const entry = { category: '陷阱' as const, content: '禁止 SUM(Year Total)' };
    const parsed = parseLearningLine(formatLearningLine(entry));
    expect(parsed!.category).toBe(entry.category);
    expect(parsed!.content).toBe(entry.content);
  });
});

// ═══════════════════════════════════════════════════════════
// 2. mergeLearnings — 合并/去重
// ═══════════════════════════════════════════════════════════

describe('mergeLearnings', () => {
  it('空 existing + 新条目 → 返回新条目并排序', () => {
    const incoming = [
      '[陷阱] 禁止 SUM(Year Total)',
      '[纠正] Function 应为 HR Allocation',
    ];
    const merged = mergeLearnings([], incoming);
    expect(merged[0]).toContain('[纠正]');
    expect(merged[1]).toContain('[陷阱]');
  });

  it('空 incoming + 已有条目 → 保持已有', () => {
    const existing = ['[方法] 分摊公式: Amount × RateNo'];
    expect(mergeLearnings(existing, [])).toEqual(existing);
  });

  it('同类相似条目 → 保留更长的', () => {
    const existing = ['[陷阱] 禁止 SUM(Year Total)'];
    const incoming = ['[陷阱] 禁止 SUM(Year Total)，年值每行重复携带相同值'];
    const merged = mergeLearnings(existing, incoming);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toBe(incoming[0]); // 更长的替换短的
  });

  it('同类不相似条目 → 两者保留', () => {
    const existing = ['[陷阱] 禁止 SUM(Year Total)'];
    const incoming = ['[陷阱] JOIN 时 Key 字段大小写不一致，需用 LOWER()'];
    const merged = mergeLearnings(existing, incoming);
    expect(merged).toHaveLength(2);
  });

  it('不同类别条目 → 全部保留并按优先级排序', () => {
    const incoming = [
      '[注意] Rate.CC 为数字类型',
      '[纠正] 正确的 Function 是 HR Allocation',
      '[方法] 分摊公式统一处理',
      '[陷阱] 禁止 SUM(Year Total)',
    ];
    const merged = mergeLearnings([], incoming);
    expect(merged[0]).toContain('[纠正]');
    expect(merged[1]).toContain('[方法]');
    expect(merged[2]).toContain('[陷阱]');
    expect(merged[3]).toContain('[注意]');
  });

  it('同类内按内容长度降序', () => {
    const incoming = [
      '[陷阱] 短',
      '[陷阱] 这是一个内容更长的陷阱描述',
      '[陷阱] 中等长度陷阱',
    ];
    const merged = mergeLearnings([], incoming);
    const trapItems = merged.filter(m => m.startsWith('[陷阱]'));
    expect(trapItems).toHaveLength(3);
    expect(trapItems[0].length).toBeGreaterThan(trapItems[1].length);
    expect(trapItems[1].length).toBeGreaterThan(trapItems[2].length);
  });

  it('无法解析的条目保留原样追加到末尾', () => {
    const existing = ['这是一条旧的非结构化学习'];
    const incoming = ['[纠正] 结构化新条目', '这也是非结构化的'];
    const merged = mergeLearnings(existing, incoming);
    // 结构化在前，非结构化在后
    const structuredIdx = merged.findIndex(m => m.startsWith('[纠正]'));
    const unparsedIdx1 = merged.findIndex(m => m === '这是一条旧的非结构化学习');
    const unparsedIdx2 = merged.findIndex(m => m === '这也是非结构化的');
    expect(structuredIdx).toBeLessThan(unparsedIdx1);
    expect(structuredIdx).toBeLessThan(unparsedIdx2);
  });

  it('大量条目合并后保持顺序和去重正确', () => {
    const existing = [
      '[纠正] Function 应全称匹配',
      '[方法] 先用 get_schema 再查',
      '[陷阱] Key 大小写问题',
    ];
    const incoming = [
      '[纠正] Function 名称应全称精确匹配，不可缩写', // 更详细的纠正 → 替换
      '[方法] 必须先 connect_datasource 再执行其他操作', // 新方法
      '[注意] SQL 保留字需用方括号包裹', // 新注意
    ];
    const merged = mergeLearnings(existing, incoming);
    // 纠正: 2条 → 合并后仍是1条（相似的替换了）
    const corrections = merged.filter(m => m.startsWith('[纠正]'));
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toBe(incoming[0]);

    // 方法: 2条
    const methods = merged.filter(m => m.startsWith('[方法]'));
    expect(methods).toHaveLength(2);

    // 陷阱: 1条
    const traps = merged.filter(m => m.startsWith('[陷阱]'));
    expect(traps).toHaveLength(1);

    // 注意: 1条
    const notes = merged.filter(m => m.startsWith('[注意]'));
    expect(notes).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════
// 3. extractLearningContents
// ═══════════════════════════════════════════════════════════

describe('extractLearningContents', () => {
  it('提取 learnings 类型记忆的内容', () => {
    const memories: Array<{ type: string; content: string }> = [
      { type: 'user', content: '用户张三' },
      { type: 'learnings', content: '[纠正] 正确用法' },
      { type: 'feedback', content: '偏好简洁回复' },
      { type: 'learnings', content: '[陷阱] 常见错误' },
      { type: 'project', content: '财务系统迁移' },
    ];
    const contents = extractLearningContents(memories);
    expect(contents).toEqual(['[纠正] 正确用法', '[陷阱] 常见错误']);
  });

  it('无 learnings 时返回空数组', () => {
    const memories: Array<{ type: string; content: string }> = [
      { type: 'user', content: '用户张三' },
    ];
    expect(extractLearningContents(memories)).toEqual([]);
  });

  it('空数组返回空', () => {
    expect(extractLearningContents([])).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// 4. getScenarioMemories — 记忆存储含 learnings
// ═══════════════════════════════════════════════════════════

describe('getScenarioMemories with learnings', () => {
  function makeStore(learnings: string[]): MemoryStore {
    const store = createEmptyStore();
    const now = Date.now();
    const scenario: ScenarioMemories = {
      project: [],
      reference: [],
      learnings: learnings.map(content => ({
        content,
        type: 'learnings' as const,
        createdAt: now,
        updatedAt: now,
      })),
    };
    store.byScenario['finance_query'] = scenario;
    return store;
  }

  it('getScenarioMemories 包含 learnings', () => {
    const store = makeStore(['[方法] 分摊公式', '[陷阱] 常见陷阱']);
    const memories = getScenarioMemories(store, 'finance_query');
    const learningContents = memories
      .filter(m => m.type === 'learnings')
      .map(m => m.content);
    expect(learningContents).toEqual(['[方法] 分摊公式', '[陷阱] 常见陷阱']);
  });

  it('无 learnings 的场景返回空 learnings', () => {
    const store = createEmptyStore();
    store.byScenario['other_scenario'] = { project: [], reference: [], learnings: [] };
    const memories = getScenarioMemories(store, 'other_scenario');
    expect(memories.filter(m => m.type === 'learnings')).toHaveLength(0);
  });

  it('旧数据无 learnings 字段时兼容', () => {
    // 模拟旧版数据: ScenarioMemories 只有 project + reference
    const store = createEmptyStore();
    store.byScenario['old_scenario'] = {
      project: [],
      reference: [],
    } as ScenarioMemories;
    const memories = getScenarioMemories(store, 'old_scenario');
    // 不应报错
    expect(memories.filter(m => m.type === 'learnings')).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════
// 5. formatScenarioLearnings — System Prompt 注入
// ═══════════════════════════════════════════════════════════

describe('formatScenarioLearnings', () => {
  function makeMemories(contents: string[]): MemoryItem[] {
    const now = Date.now();
    return contents.map(content => ({
      content,
      type: 'learnings' as const,
      createdAt: now,
      updatedAt: now,
    }));
  }

  it('无 learnings 记忆时返回空字符串', () => {
    const memories: MemoryItem[] = [
      { content: '用户张三', type: 'user', createdAt: 0, updatedAt: 0 },
    ];
    expect(formatScenarioLearnings(memories)).toBe('');
  });

  it('生成带上下文围栏的结构化输出', () => {
    const memories = makeMemories([
      '[纠正] Function 应为 HR Allocation',
      '[方法] 分摊公式: Amount × RateNo',
    ]);
    const output = formatScenarioLearnings(memories);
    expect(output).toContain('<learnings-context>');
    expect(output).toContain('</learnings-context>');
    expect(output).toContain('[System note:');
    expect(output).toContain('[纠正] Function 应为 HR Allocation');
    expect(output).toContain('[方法] 分摊公式: Amount × RateNo');
  });

  it('按类别优先级排序: 纠正 > 方法 > 陷阱 > 注意', () => {
    const memories = makeMemories([
      '[注意] 类型差异',
      '[陷阱] 常见陷阱',
      '[纠正] 用户纠正的错误',
      '[方法] 计算方法',
    ]);
    const output = formatScenarioLearnings(memories);
    const idxCorrect = output.indexOf('[纠正]');
    const idxMethod = output.indexOf('[方法]');
    const idxTrap = output.indexOf('[陷阱]');
    const idxNote = output.indexOf('[注意]');
    expect(idxCorrect).toBeLessThan(idxMethod);
    expect(idxMethod).toBeLessThan(idxTrap);
    expect(idxTrap).toBeLessThan(idxNote);
  });

  it('超预算时截断并标注', () => {
    // 生成足够多的长条目以超过 500 字符预算
    const longContents = Array.from({ length: 30 }, (_, i) =>
      `[注意] 这是第 ${i + 1} 条领域知识学习条目，包含较长的描述内容以便测试预算控制机制`
    );
    const memories = makeMemories(longContents);
    const output = formatScenarioLearnings(memories);
    expect(output).toContain('</learnings-context>');
    // 应有截断提示
    expect(output).toContain('共');
    expect(output).toContain('条经验');
    // 输出长度应受控
    expect(output.length).toBeLessThan(1000);
  });

  it('少量条目在预算内不截断', () => {
    const memories = makeMemories([
      '[纠正] 简短纠正',
      '[陷阱] 简短陷阱',
    ]);
    const output = formatScenarioLearnings(memories);
    expect(output).toContain('[纠正] 简短纠正');
    expect(output).toContain('[陷阱] 简短陷阱');
    // 不包含截断提示
    expect(output).not.toContain('已展示');
  });

  it('非 learnings 类型的记忆不混入输出', () => {
    const memories: MemoryItem[] = [
      ...makeMemories(['[方法] 正确方法']),
      { content: '用户偏好简洁', type: 'feedback', createdAt: 0, updatedAt: 0 },
      { content: '这是一个项目上下文', type: 'project', createdAt: 0, updatedAt: 0 },
    ];
    const output = formatScenarioLearnings(memories);
    expect(output).toContain('[方法]');
    expect(output).not.toContain('用户偏好');
    expect(output).not.toContain('项目上下文');
  });

  it('混合结构化和非结构化条目时正确处理', () => {
    const memories = makeMemories([
      '[纠正] 结构化纠正',
      '非结构化的旧格式学习',
      '[陷阱] 结构化陷阱',
    ]);
    const output = formatScenarioLearnings(memories);
    // 结构化条目在前
    expect(output.indexOf('[纠正]')).toBeLessThan(output.indexOf('非结构化'));
    expect(output.indexOf('[陷阱]')).toBeLessThan(output.indexOf('非结构化'));
  });
});

// ═══════════════════════════════════════════════════════════
// 6. 端到端集成场景
// ═══════════════════════════════════════════════════════════

describe('E2E: 完整学习生命周期', () => {
  it('空记忆库 → 提取学习 → 合并 → 注入 prompt', () => {
    // Step 1: 模拟首次提取
    const firstExtraction = [
      '[纠正] Function 应为 HR Allocation 而非 HR',
      '[陷阱] 禁止 SUM(Year Total)',
    ];

    // Step 2: 合并到空记忆库
    const afterFirst = mergeLearnings([], firstExtraction);
    expect(afterFirst).toHaveLength(2);

    // Step 3: 注入 system prompt
    const now = Date.now();
    const memories1: MemoryItem[] = afterFirst.map(content => ({
      content, type: 'learnings' as const, createdAt: now, updatedAt: now,
    }));
    const prompt1 = formatScenarioLearnings(memories1);
    expect(prompt1).toContain('[纠正]');
    expect(prompt1).toContain('[陷阱]');
    expect(prompt1).toContain('<learnings-context>');

    // Step 4: 模拟第二次提取 — 有重复和新增
    const secondExtraction = [
      '[纠正] Function 名称应用全称 HR Allocation，不可缩写', // 更详细版本
      '[方法] 分摊计算前必须先 connect_datasource', // 全新
    ];

    // Step 5: 迭代合并
    const afterSecond = mergeLearnings(afterFirst, secondExtraction);
    // 纠正类应只有 1 条（更详细的替换了短的）
    const corrections = afterSecond.filter(l => l.startsWith('[纠正]'));
    expect(corrections).toHaveLength(1);
    expect(corrections[0]).toContain('不可缩写');
    // 应有陷阱和方法
    expect(afterSecond.some(l => l.startsWith('[陷阱]'))).toBe(true);
    expect(afterSecond.some(l => l.startsWith('[方法]'))).toBe(true);
    expect(afterSecond).toHaveLength(3);
  });

  it('多轮迭代不会无限膨胀', () => {
    let state: string[] = [];

    // 模拟 10 轮提取，每轮 2 条不同的学习
    const methodTopics = [
      '分摊公式统一使用 Amount × RateNo',
      'connect_datasource 必须在查询前调用',
      'Key 字段需要精确匹配大小写',
      '禁止使用未命名的子查询',
      'RateNo 来源于 AllocationRule 表',
      'JOIN 前检查字段类型一致性',
      '报表日期格式统一为 YYYY-MM-DD',
      'NULL 值需用 ISNULL 处理而非 = NULL',
      '跨年度数据需要分别查询各年',
      'CC Mapping 的 Key 是字符串类型',
    ];
    const noteTopics = [
      'Rate.CC 是数字，CC Mapping.CC 是字符串',
      'SQL 保留字需用方括号包裹',
      '大表查询前先确认索引状态',
      'TXN_DATE 字段是文本而非日期',
      '金额字段需除以 100 转换单位',
      '多币种场景需指定汇率来源',
      '超 10 万行需分批处理',
      '临时表用完需显式 DROP',
      'DISTINCT 可能影响性能需评估',
      'UPPER 函数比 LOWER 更快',
    ];

    for (let round = 0; round < 10; round++) {
      const extracted = [
        `[方法] ${methodTopics[round]}`,
        `[注意] ${noteTopics[round]}`,
      ];
      state = mergeLearnings(state, extracted);
    }

    // 由于每轮的 [方法] 和 [注意] 语义不同（因为内容不同），它们应该都保留
    // 但至少类别排序正确
    expect(state[0]).toContain('[方法]');
    // 总共 20 条
    expect(state).toHaveLength(20);
  });
});
