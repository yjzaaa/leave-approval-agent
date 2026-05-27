/**
 * 财务问数 — 全部 11 个 Tool 定义
 *
 * 分 4 层: 连接层(2) → 查询层(5) → 计算层(2) → 输出层(1)
 * 通过工厂函数注入 IDataSource，不直接依赖具体实现。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { IDataSource, TableMeta } from '../../domain/interfaces/IDataSource.js';
import type { ContentBlock } from '../../domain/interfaces/IContentBlock.js';
import {
  validateTable,
  validateColumns,
  validateWhereColumns,
  validateMetric,
  validateChartType,
  validateSortDirection,
  validateJoinType,
  validateSql,
} from './validator.js';

// ══════════════════════════════════════════════
// 模块级 schema 缓存 — 由 connect_datasource 写入，后续 tool 读取
// ══════════════════════════════════════════════

let schemaCache: TableMeta[] | null = null;
const getCachedSchema = (): TableMeta[] | null => schemaCache;
const setCachedSchema = (tables: TableMeta[]): void => { schemaCache = tables; };

export function createFinanceQueryTools(dataSource: IDataSource): AgentTool[] {
  // ════════════════════════════════════════════════
  // 连接层 (2)
  // ════════════════════════════════════════════════

  /** 默认数据文件路径 */
  const DEFAULT_DATASOURCE_PATH = 'test-data/function-cost-allocation.xlsx';

  /** 加载 Excel 文件并返回表结构 */
  const connectDatasourceTool: AgentTool = {
    name: 'connect_datasource',
    label: '连接数据源',
    description: '加载 Excel 数据文件。不传 filePath 则自动使用默认数据源。所有查询之前必须先调用此工具。',
    parameters: Type.Object({
      filePath: Type.Optional(Type.String({ description: 'Excel 文件路径，不传则使用默认数据源' })),
    }),
    execute: async (_id, params) => {
      const { filePath } = params as { filePath?: string };
      const path = filePath || DEFAULT_DATASOURCE_PATH;
      const tables = await dataSource.connect(path);
      setCachedSchema(tables);
      const summary = tables.map((t) =>
        `${t.name}: ${t.columns.map((c) => `${c.name}(${c.type})`).join(', ')} (${t.rowCount} 行)`,
      ).join('\n');
      return {
        content: [{ type: 'text' as const, text: `已加载 ${tables.length} 个表:\n${summary}` }],
        details: tables,
      };
    },
  };

  /** 获取表结构 */
  const getSchemaTool: AgentTool = {
    name: 'get_schema',
    label: '获取表结构',
    description: '获取指定表或所有表的列名、类型和示例值。查询前先用此了解数据。',
    parameters: Type.Object({
      tableName: Type.Optional(Type.String({ description: '表名，不传则返回所有表' })),
    }),
    execute: async (_id, params) => {
      const { tableName } = params as { tableName?: string };
      const cache = getCachedSchema();
      if (!cache) {
        return { content: [{ type: 'text' as const, text: '数据源未连接，请先调用 connect_datasource' }], details: null };
      }
      const tables = tableName ? cache.filter((t) => t.name === tableName) : cache;
      if (tableName && tables.length === 0) {
        return { content: [{ type: 'text' as const, text: `表 "${tableName}" 不存在。可用: ${cache.map((t) => t.name).join(', ')}` }], details: null };
      }
      const text = tables.map((t) =>
        `表 ${t.name} (${t.rowCount} 行):\n${t.columns.map((c) => `  ${c.name}: ${c.type}`).join('\n')}`,
      ).join('\n\n');
      return { content: [{ type: 'text' as const, text }], details: tables };
    },
  };

  // ════════════════════════════════════════════════
  // 查询层 (5)
  // ════════════════════════════════════════════════

  /** 自由 SQL 查询（LLM 组合语法无法覆盖的复杂场景） */
  const sqlQueryTool: AgentTool = {
    name: 'sql_query',
    label: 'SQL查询',
    description: '直接执行 SQL SELECT 语句。用于复杂查询，复用已有数据。先了解表结构再使用。',
    parameters: Type.Object({
      sql: Type.String({ description: 'SELECT 查询语句' }),
    }),
    execute: async (_id, params) => {
      const { sql } = params as { sql: string };
      const sqlCheck = validateSql(sql);
      if (!sqlCheck.valid) {
        return { content: [{ type: 'text' as const, text: sqlCheck.errors.join('; ') }], details: null };
      }
      const result = await dataSource.query(sql);
      const preview = result.rows.slice(0, 20);
      const text = `查询结果 (${result.rowCount} 行, 显示前 ${preview.length} 行):\n${JSON.stringify(preview, null, 2)}`;
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };

  /** 行过滤 + 列投影 */
  const selectDataTool: AgentTool = {
    name: 'select_data',
    label: '查询数据',
    description: '从指定表中查询数据。支持列投影(columns)、条件过滤(where)、分页(limit/offset)。where 为键值对数组。',
    parameters: Type.Object({
      table: Type.String({ description: '表名' }),
      columns: Type.Optional(Type.Array(Type.String(), { description: '要返回的列名，不传返回全部' })),
      where: Type.Optional(Type.Array(Type.Object({
        field: Type.String(),
        op: Type.Optional(Type.String({ description: '比较运算符: =, >, <, >=, <=, !=, LIKE (默认 =)' })),
        value: Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]),
      }), { description: '筛选条件数组' })),
      limit: Type.Optional(Type.Number({ description: '返回行数上限' })),
      offset: Type.Optional(Type.Number({ description: '跳过行数' })),
    }),
    execute: async (_id, params) => {
      const { table, columns, where, limit, offset } = params as {
        table: string; columns?: string[]; where?: Array<{ field: string; op?: string; value: unknown }>;
        limit?: number; offset?: number;
      };
      const cache = getCachedSchema();
      if (!cache) {
        return { content: [{ type: 'text' as const, text: '数据源未连接，请先调用 connect_datasource' }], details: null };
      }

      // 校验表
      const tableResult = validateTable(table, cache);
      if (!tableResult.valid) {
        return { content: [{ type: 'text' as const, text: tableResult.errors.join('; ') }], details: null };
      }

      const schema = cache.find((t) => t.name === table)!;

      // 校验列
      if (columns) {
        const colResult = validateColumns(table, columns, schema);
        if (!colResult.valid) {
          return { content: [{ type: 'text' as const, text: colResult.errors.join('; ') }], details: null };
        }
      }

      // 校验 where 条件中的列
      if (where && where.length > 0) {
        const whereResult = validateWhereColumns(table, where, schema);
        if (!whereResult.valid) {
          return { content: [{ type: 'text' as const, text: whereResult.errors.join('; ') }], details: null };
        }
      }

      // 构建 SQL
      const cols = columns && columns.length > 0 ? columns.map((c) => `[${c}]`).join(', ') : '*';
      let sql = `SELECT ${cols} FROM [${table}]`;
      if (where && where.length > 0) {
        const clauses = where.map((w) => {
          const op = w.op || '=';
          const val = typeof w.value === 'string' ? `'${w.value.replace(/'/g, "''")}'` : w.value === null ? 'NULL' : String(w.value);
          return op.toUpperCase() === 'LIKE' ? `[${w.field}] ${op} ${val}` : `[${w.field}] ${op} ${val}`;
        });
        sql += ` WHERE ${clauses.join(' AND ')}`;
      }
      if (limit !== undefined) {
        sql += ` LIMIT ${limit}`;
        if (offset !== undefined) sql += ` OFFSET ${offset}`;
      }

      const result = await dataSource.query(sql);
      const preview = result.rows.slice(0, 20);
      const text = `查询结果 (${result.rowCount} 行, 显示前 ${preview.length} 行):\n${JSON.stringify(preview, null, 2)}`;
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };

  /** GROUP BY 聚合 */
  const aggregateDataTool: AgentTool = {
    name: 'aggregate_data',
    label: '聚合数据',
    description: '对数据分组聚合。metrics 中 fn 支持 SUM/COUNT/AVG/MAX/MIN。',
    parameters: Type.Object({
      table: Type.String({ description: '表名' }),
      groupBy: Type.Array(Type.String(), { description: '分组列名' }),
      metrics: Type.Array(Type.Object({
        field: Type.String(),
        fn: Type.String({ description: 'SUM | COUNT | AVG | MAX | MIN' }),
        alias: Type.Optional(Type.String()),
      })),
    }),
    execute: async (_id, params) => {
      const { table, groupBy, metrics } = params as {
        table: string; groupBy: string[]; metrics: Array<{ field: string; fn: string; alias?: string }>;
      };
      const cache = getCachedSchema();
      if (!cache) {
        return { content: [{ type: 'text' as const, text: '数据源未连接，请先调用 connect_datasource' }], details: null };
      }

      const tableCheck = validateTable(table, cache);
      if (!tableCheck.valid) {
        return { content: [{ type: 'text' as const, text: tableCheck.errors.join('; ') }], details: null };
      }

      for (const m of metrics) {
        const metricCheck = validateMetric(m);
        if (!metricCheck.valid) {
          return { content: [{ type: 'text' as const, text: metricCheck.errors.join('; ') }], details: null };
        }
      }

      const selectParts = [
        ...groupBy.map((g) => `[${g}]`),
        ...metrics.map((m) => `${m.fn}([${m.field}]) AS [${m.alias || `${m.fn}_${m.field}`}]`),
      ];
      const sql = `SELECT ${selectParts.join(', ')} FROM [${table}] GROUP BY ${groupBy.map((g) => `[${g}]`).join(', ')}`;

      const result = await dataSource.query(sql);
      const text = `聚合结果 (${result.rowCount} 行):\n${JSON.stringify(result.rows, null, 2)}`;
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };

  /** JOIN 连接 */
  const joinDataTool: AgentTool = {
    name: 'join_data',
    label: '连接表',
    description: '连接两个表。支持 LEFT/RIGHT/INNER JOIN。on 为连接条件数组。',
    parameters: Type.Object({
      leftTable: Type.String(),
      rightTable: Type.String(),
      on: Type.Array(Type.Object({
        leftField: Type.String(),
        rightField: Type.String(),
      })),
      type: Type.Optional(Type.String({ description: '连接类型: LEFT | RIGHT | INNER (默认 LEFT)' })),
    }),
    execute: async (_id, params) => {
      const { leftTable, rightTable, on, type } = params as {
        leftTable: string; rightTable: string; on: Array<{ leftField: string; rightField: string }>; type?: string;
      };
      const cache = getCachedSchema();
      if (!cache) {
        return { content: [{ type: 'text' as const, text: '数据源未连接，请先调用 connect_datasource' }], details: null };
      }

      const joinType = (type || 'LEFT').toUpperCase();
      const typeCheck = validateJoinType(joinType);
      if (!typeCheck.valid) {
        return { content: [{ type: 'text' as const, text: typeCheck.errors.join('; ') }], details: null };
      }

      const leftCheck = validateTable(leftTable, cache);
      if (!leftCheck.valid) {
        return { content: [{ type: 'text' as const, text: leftCheck.errors.join('; ') }], details: null };
      }
      const rightCheck = validateTable(rightTable, cache);
      if (!rightCheck.valid) {
        return { content: [{ type: 'text' as const, text: rightCheck.errors.join('; ') }], details: null };
      }

      const onClauses = on.map((o) => `[${leftTable}].[${o.leftField}] = [${rightTable}].[${o.rightField}]`).join(' AND ');
      const sql = `SELECT * FROM [${leftTable}] ${joinType} JOIN [${rightTable}] ON ${onClauses}`;

      const result = await dataSource.query(sql);
      const preview = result.rows.slice(0, 20);
      const text = `连接结果 (${result.rowCount} 行, 显示前 ${preview.length} 行):\n${JSON.stringify(preview, null, 2)}`;
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };

  /** 排序 */
  const sortDataTool: AgentTool = {
    name: 'sort_data',
    label: '排序数据',
    description: '对查询结果排序。需先执行 select_data 获取中间结果。',
    parameters: Type.Object({
      table: Type.String({ description: '要排序的表名' }),
      sortBy: Type.Array(Type.String(), { description: '排序列名' }),
      direction: Type.Optional(Type.String({ description: 'asc | desc (默认 asc)' })),
    }),
    execute: async (_id, params) => {
      const { table, sortBy, direction } = params as { table: string; sortBy: string[]; direction?: string };
      const cache = getCachedSchema();
      if (!cache) {
        return { content: [{ type: 'text' as const, text: '数据源未连接，请先调用 connect_datasource' }], details: null };
      }

      const dir = (direction || 'asc').toLowerCase();
      const dirCheck = validateSortDirection(dir);
      if (!dirCheck.valid) {
        return { content: [{ type: 'text' as const, text: dirCheck.errors.join('; ') }], details: null };
      }

      const tableCheck = validateTable(table, cache);
      if (!tableCheck.valid) {
        return { content: [{ type: 'text' as const, text: tableCheck.errors.join('; ') }], details: null };
      }

      const orderClause = sortBy.map((c) => `[${c}] ${dir.toUpperCase()}`).join(', ');
      const sql = `SELECT * FROM [${table}] ORDER BY ${orderClause}`;

      const result = await dataSource.query(sql);
      const preview = result.rows.slice(0, 20);
      const text = `排序结果 (${result.rowCount} 行, 显示前 ${preview.length} 行):\n${JSON.stringify(preview, null, 2)}`;
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };

  // ════════════════════════════════════════════════
  // 计算层 (2)
  // ════════════════════════════════════════════════

  /** 计算派生字段 */
  const calculateFieldsTool: AgentTool = {
    name: 'calculate_fields',
    label: '计算字段',
    description: '在已查询结果上计算派生字段。expressions 中 expression 为 JS 表达式，使用 [列名] 引用字段。',
    parameters: Type.Object({
      table: Type.String({ description: '来源表名（需先 select_data）' }),
      expressions: Type.Array(Type.Object({
        expression: Type.String({ description: '计算表达式，如 [amount] * [rate] / 100' }),
        alias: Type.String({ description: '结果字段名' }),
      })),
    }),
    execute: async (_id, params) => {
      const { table, expressions } = params as {
        table: string; expressions: Array<{ expression: string; alias: string }>;
      };
      const cache = getCachedSchema();
      if (!cache) {
        return { content: [{ type: 'text' as const, text: '数据源未连接，请先调用 connect_datasource' }], details: null };
      }

      const tableCheck = validateTable(table, cache);
      if (!tableCheck.valid) {
        return { content: [{ type: 'text' as const, text: tableCheck.errors.join('; ') }], details: null };
      }

      // 构建 SELECT: 原始列 + 计算列
      const selectParts = expressions.map((e) => {
        // 将 [col] 引用转换为 SELECT 中的合法表达式
        const expr = e.expression.replace(/\[(\w+)\]/g, (_, col: string) => `[${col}]`);
        return `${expr} AS [${e.alias}]`;
      });
      const sql = `SELECT *, ${selectParts.join(', ')} FROM [${table}]`;

      const result = await dataSource.query(sql);
      const text = `计算结果 (${result.rowCount} 行):\n${JSON.stringify(result.rows.slice(0, 20), null, 2)}`;
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };

  /** 生成成本分摊 SQL 模板 */
  const generateCostRateSqlTool: AgentTool = {
    name: 'generate_cost_rate_sql',
    label: '生成成本分摊SQL',
    description: '根据参数生成成本分摊分析 SQL。用于财务领域的成本费率分配查询。',
    parameters: Type.Object({
      year: Type.String({ description: '年度' }),
      scenario: Type.String({ description: '场景名称' }),
      func: Type.String({ description: '功能模块' }),
      cc: Type.Optional(Type.String({ description: '成本中心（可选）' })),
    }),
    execute: async (_id, params) => {
      const { year, scenario, func, cc } = params as {
        year: string; scenario: string; func: string; cc?: string;
      };

      let whereSql = `year = '${year}' AND scenario = '${scenario}' AND func = '${func}'`;
      if (cc) whereSql += ` AND cc = '${cc}'`;

      const sql = `SELECT cc, func, scenario, year, amount, rate, (amount * rate) AS cost FROM [cost_data] WHERE ${whereSql}`;

      return {
        content: [{ type: 'text' as const, text: `生成的 SQL:\n\`\`\`sql\n${sql}\n\`\`\`\n可直接用 sql_query 执行此查询。` }],
        details: { sql, params: { year, scenario, func, cc: cc || null } },
      };
    },
  };

  // ════════════════════════════════════════════════
  // 计算层 — 封装成本分摊（避免模型手写 SQL 漏算 Allocation）
  // ════════════════════════════════════════════════

  /** 参数校验 */
  function validateCostParams(params: {
    year: string; scenario: string; function: string; cc?: string; bl?: string;
  }): string | null {
    if (!params.year) return 'year 不能为空';
    if (!params.scenario) return 'scenario 不能为空';
    if (!params.function) return 'function 不能为空';
    if (params.cc && params.bl) return 'cc 和 bl 不能同时指定';
    return null;
  }

  /** 从 schema 缓存中查找表名（按关键字匹配，兼容不同 Excel 文件的 sheet 命名） */
  function resolveTable(cache: TableMeta[], keywords: string[]): string | null {
    const name = cache.find((t) =>
      keywords.every((kw) => t.name.toLowerCase().includes(kw.toLowerCase())),
    );
    return name ? name.name : null;
  }

  /** 封装成本分摊计算 — 自动 JOIN + 分离正向/Allocation 抵消 */
  const calculateFunctionCostTool: AgentTool = {
    name: 'calculate_function_cost',
    label: '计算功能成本分摊',
    description:
      '计算指定 Function 在某财年/场景下分摊到某 CC 或业务线的净成本。'
      + '自动处理 CostDataBase + Rate 的 JOIN，分离正向费用和 Allocation 抵消项，返回净分摊。'
      + '需要按 CC 或 BL 对比两个时间点时，分别调用两次然后对比结果。'
      + '禁止自己写 SQL 来做成本分摊，必须使用此 Tool。',
    parameters: Type.Object({
      year: Type.String({ description: '财年，如 FY26' }),
      scenario: Type.String({ description: '场景名，如 Budget1 / Actual' }),
      function: Type.String({ description: 'Function 名称，如 HR / IT' }),
      cc: Type.Optional(Type.String({ description: '成本中心代码（可选），如 413001' })),
      bl: Type.Optional(Type.String({ description: '业务线（可选），如 XP。与 cc 二选一' })),
    }),
    execute: async (_id, params) => {
      const { year, scenario, function: func, cc, bl } = params as {
        year: string; scenario: string; function: string; cc?: string; bl?: string;
      };

      const cache = getCachedSchema();
      if (!cache) {
        return { content: [{ type: 'text' as const, text: '数据源未连接，请先调用 connect_datasource' }], details: null };
      }

      const paramErr = validateCostParams({ year, scenario, function: func, cc, bl });
      if (paramErr) {
        return { content: [{ type: 'text' as const, text: paramErr }], details: null };
      }

      // 从 schema 动态解析表名（兼容不同 Excel 文件的 sheet 命名）
      const costTable = resolveTable(cache, ['cost']);
      const rateTable = resolveTable(cache, ['rate']);
      const mappingTable = resolveTable(cache, ['cc', 'mapping']);

      if (!costTable || !rateTable) {
        return {
          content: [{ type: 'text' as const, text: `无法定位数据表。Cost: ${costTable}, Rate: ${rateTable}。可用: ${cache.map((t) => t.name).join(', ')}` }],
          details: null,
        };
      }

      const safe = (s: string) => s.replace(/'/g, "''");

      let joinClause = '';
      let whereExtra: string;

      if (cc) {
        whereExtra = ` AND r.CC = '${safe(cc)}'`;
      } else if (bl) {
        if (!mappingTable) {
          return {
            content: [{ type: 'text' as const, text: `无法定位 CC Mapping 表。可用: ${cache.map((t) => t.name).join(', ')}` }],
            details: null,
          };
        }
        joinClause = ` JOIN [${mappingTable}] cm ON r.CC = cm.CC`;
        whereExtra = ` AND cm.[Business Line] = '${safe(bl)}'`;
      } else {
        whereExtra = '';
      }

      const sql = [
        'SELECT',
        '  c.[Cost text] AS cost_text,',
        '  c.[Function] AS func,',
        '  SUM(c.Amount * r.RateNo) AS allocated_amount',
        `FROM [${costTable}] c`,
        `JOIN [${rateTable}] r ON c.Year = r.Year`,
        '  AND c.Scenario = r.Scenario',
        '  AND c.Month = r.Month',
        '  AND LOWER(c.[Key]) = LOWER(r.[Key])',
        joinClause,
        `WHERE c.Year = '${safe(year)}'`,
        `  AND c.Scenario = '${safe(scenario)}'`,
        `  AND c.[Function] = '${safe(func)}'`,
        whereExtra,
        'GROUP BY c.[Cost text], c.[Function]',
      ].filter(Boolean).join('\n');

      const result = await dataSource.query(sql);
      const rows = result.rows as Array<{ cost_text: string; func: string; allocated_amount: number }>;

      if (rows.length === 0) {
        const label = cc ? `CC ${cc}` : bl ? `BL ${bl}` : '指定条件';
        return {
          content: [{ type: 'text' as const, text: `${year} ${scenario} 中 ${label} 的 ${func} Function 无数据` }],
          details: { positiveItems: [], allocationItems: [], totalPositive: 0, totalAllocation: 0, netTotal: 0, sql },
        };
      }

      const positiveItems: Array<{ costText: string; amount: number }> = [];
      const allocationItems: Array<{ costText: string; amount: number }> = [];

      for (const row of rows) {
        const item = { costText: row.cost_text, amount: Math.round(row.allocated_amount) };
        if (row.cost_text.toLowerCase().includes('allocation')) {
          allocationItems.push(item);
        } else {
          positiveItems.push(item);
        }
      }

      const totalPositive = positiveItems.reduce((s, i) => s + i.amount, 0);
      const totalAllocation = allocationItems.reduce((s, i) => s + i.amount, 0);
      const netTotal = totalPositive + totalAllocation;

      const scope = cc ? `CC ${cc}` : bl ? `BL ${bl}` : '全部';

      let text = `## ${func} Function 成本分摊 — ${year} ${scenario} (${scope})\n\n`;

      if (positiveItems.length > 0) {
        text += '| Cost Text | 分摊金额 |\n|-----------|--------|\n';
        for (const item of positiveItems) {
          text += `| ${item.costText} | ${item.amount.toLocaleString()} |\n`;
        }
        text += `| **正向合计** | **${totalPositive.toLocaleString()}** |\n\n`;
      }

      if (allocationItems.length > 0) {
        for (const item of allocationItems) {
          text += `| ${item.costText} | ${item.amount.toLocaleString()} |\n`;
        }
        text += `| **Allocation 抵消** | **${totalAllocation.toLocaleString()}** |\n\n`;
      }

      text += `| **净分摊** | **${netTotal.toLocaleString()}** |`;

      return {
        content: [{ type: 'text' as const, text }],
        details: { positiveItems, allocationItems, totalPositive, totalAllocation, netTotal, sql },
      };
    },
  };

  // ════════════════════════════════════════════════
  // 输出层 (1)
  // ════════════════════════════════════════════════

  /** 生成图表 */
  const generateChartTool: AgentTool = {
    name: 'generate_chart',
    label: '生成图表',
    description: '根据数据生成图表。type 支持 pie/bar/line/stacked_bar。返回 ContentBlock 用于前端渲染。',
    parameters: Type.Object({
      type: Type.String({ description: '图表类型: pie | bar | line | stacked_bar' }),
      title: Type.String({ description: '图表标题' }),
      labels: Type.Array(Type.String(), { description: 'X 轴标签 / 分类名称' }),
      values: Type.Array(Type.Number(), { description: '数据值' }),
    }),
    execute: async (_id, params) => {
      const { type, title, labels, values } = params as {
        type: string; title: string; labels: string[]; values: number[];
      };

      const chartCheck = validateChartType(type);
      if (!chartCheck.valid) {
        return { content: [{ type: 'text' as const, text: chartCheck.errors.join('; ') }], details: null };
      }

      const blocks: ContentBlock[] = [{
        type: 'chart',
        data: { chartType: type, title, labels, values },
      }];

      return {
        content: [{ type: 'text' as const, text: `图表 "${title}" 已生成 (${type}, ${labels.length} 项)` }],
        details: { blocks },
      };
    },
  };

  // ── 返回全部 11 个 Tool ──
  return [
    // 连接层
    connectDatasourceTool,
    getSchemaTool,
    // 查询层
    sqlQueryTool,
    selectDataTool,
    aggregateDataTool,
    joinDataTool,
    sortDataTool,
    // 计算层
    calculateFieldsTool,
    generateCostRateSqlTool,
    calculateFunctionCostTool,
    // 输出层
    generateChartTool,
  ];
}
