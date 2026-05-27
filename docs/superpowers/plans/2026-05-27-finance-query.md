# 财务问数系统场景实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在当前项目中新增 `finance-query` 场景，复刻 AI2 的财务问数功能（单 Agent + 11 个组合 Tool + ContentBlock 通用渲染协议）

**Architecture:** 4 层 11 Tool 场景（连接→查询→计算→输出），IDataSource 接口 + Excel 实现（alasql），ContentBlock SSE 协议 + 前端注册表式渲染器（chart/table/card）

**Tech Stack:** TypeScript, Pi Agent Core, alasql, xlsx, ECharts, React

---

## 文件变更总览

| 阶段 | 新建 | 修改 |
|------|------|------|
| 1 — 领域类型 | 2 个接口文件 | — |
| 2 — 数据源 | 2 个 datasource 文件 | 1 个 DI 注册 |
| 3 — 场景 | 5 个 scenario 文件 | 1 个 registry |
| 4 — SSE | — | 1 个 agent-factory |
| 5 — 前端 | 4 个 renderer 文件 | 2 个 hooks |
| 6 — 集成 | — | 2 个 deps + chat 组件 |

---

### Task 1: 创建 IDataSource 接口

**Files:**
- Create: `src/models/domain/interfaces/IDataSource.ts`

- [ ] **Step 1: 编写 IDataSource 接口**

```ts
/**
 * 数据源接口 — 抽象数据查询能力
 *
 * 实现类通过 connect() 加载数据，query() 执行 SELECT 查询。
 * 仅允许 SELECT，禁止 DDL/DML。
 */
/** 列元数据 */
export interface ColumnMeta {
  /** 列名 */
  name: string;
  /** 列类型 */
  type: 'string' | 'number' | 'date';
}

/** 表元数据 */
export interface TableMeta {
  /** 表名 */
  name: string;
  /** 列列表 */
  columns: ColumnMeta[];
  /** 行数 */
  rowCount: number;
}

/** 查询结果 */
export interface QueryResult {
  /** 列名顺序 */
  columns: string[];
  /** 数据行 */
  rows: Record<string, unknown>[];
  /** 行数 */
  rowCount: number;
  /** 实际执行的 SQL */
  sql: string;
}

/** 数据源接口 */
export interface IDataSource {
  /** 连接数据源，返回可用表列表 */
  connect(filePath: string): Promise<TableMeta[]>;
  /** 执行 SELECT 查询 */
  query(sql: string): Promise<QueryResult>;
}
```

- [ ] **Step 2: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS（纯类型文件，零外部依赖）

- [ ] **Step 3: 提交**

```bash
git add src/models/domain/interfaces/IDataSource.ts
git commit -m "feat: 创建 IDataSource 接口 — ColumnMeta / TableMeta / QueryResult"
```

---

### Task 2: 创建 IContentBlock 接口

**Files:**
- Create: `src/models/domain/interfaces/IContentBlock.ts`

- [ ] **Step 1: 编写 IContentBlock 接口**

```ts
/**
 * 内容块协议 — 统一的可视化数据承载协议
 *
 * Tool 输出 ContentBlock[]，前端 ContentRenderer 按 type 匹配渲染器。
 * 新增可视化类型只需实现新渲染器并 register。
 */
/** 内容块 */
export interface ContentBlock {
  /** 块类型标识: "chart" | "table" | "card" | "list" | ... */
  type: string;
  /** 类型特定的 payload */
  data: Record<string, unknown>;
}
```

- [ ] **Step 2: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 3: 提交**

```bash
git add src/models/domain/interfaces/IContentBlock.ts
git commit -m "feat: 创建 ContentBlock 接口 — 统一可视化数据承载协议"
```

---

### Task 3: 实现 ExcelDataSource

**Files:**
- Create: `src/infrastructure/datasource/excel-source.ts`

- [ ] **Step 1: 安装依赖**

```bash
npm install xlsx alasql
```

- [ ] **Step 2: 编写 ExcelDataSource**

```ts
/**
 * Excel 数据源 — 使用 xlsx 读取 Excel，alasql 执行 SQL 查询
 */
import * as XLSX from 'xlsx';
import alasql from 'alasql';
import type { IDataSource, TableMeta, QueryResult } from '../../models/domain/interfaces/IDataSource.js';

/** 禁止的 DDL/DML 关键字 */
const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;

/** Excel 数据源实现 */
export class ExcelDataSource implements IDataSource {
  private loaded = false;

  /** 从 Excel 文件加载所有 sheet 到 alasql 内存表 */
  async connect(filePath: string): Promise<TableMeta[]> {
    const workbook = XLSX.readFile(filePath);
    const tables: TableMeta[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

      if (jsonData.length === 0) continue;

      // 推断列类型（基于前 100 行采样）
      const sample = jsonData.slice(0, 100);
      const firstRow = jsonData[0];
      const columns = Object.keys(firstRow).map((name) => {
        const allNumbers = sample.every((row) => {
          const v = row[name];
          return v === null || v === undefined || typeof v === 'number' || (!isNaN(Number(v)) && v !== '');
        });
        const allDates = sample.every((row) => {
          const v = row[name];
          if (v === null || v === undefined) return true;
          if (typeof v === 'number' && v > 40000 && v < 60000) return true; // Excel 日期序列号
          return !isNaN(Date.parse(String(v)));
        });
        return {
          name,
          type: (allDates && !allNumbers ? 'date' : allNumbers ? 'number' : 'string') as 'string' | 'number' | 'date',
        };
      });

      // 导入到 alasql
      alasql(`CREATE TABLE [${sheetName}]`);
      alasql.tables[sheetName].data = jsonData;

      tables.push({ name: sheetName, columns, rowCount: jsonData.length });
    }

    this.loaded = true;
    return tables;
  }

  /** 执行 SELECT 查询 */
  async query(sql: string): Promise<QueryResult> {
    if (!this.loaded) {
      throw new Error('数据源未连接，请先调用 connect_datasource');
    }

    if (FORBIDDEN_SQL.test(sql)) {
      const keyword = sql.match(FORBIDDEN_SQL)?.[0];
      throw new Error(`禁止执行非查询操作: ${keyword}`);
    }

    if (!/^\s*SELECT/i.test(sql)) {
      throw new Error('仅允许 SELECT 查询');
    }

    const rows = alasql(sql) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return { columns, rows, rowCount: rows.length, sql };
  }
}
```

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 4: 提交**

```bash
git add src/infrastructure/datasource/excel-source.ts package.json package-lock.json
git commit -m "feat: 实现 ExcelDataSource — xlsx 读取 + alasql SQL 查询 + 安全校验"
```

---

### Task 4: 创建 datasource 汇总导出 + DI 注册

**Files:**
- Create: `src/infrastructure/datasource/index.ts`
- Modify: `src/infrastructure/di/index.ts`

- [ ] **Step 1: 编写 datasource/index.ts**

```ts
/** 数据源模块 — 汇总导出 */
export { ExcelDataSource } from './excel-source.js';
```

- [ ] **Step 2: DI 注册 dataSource**

修改 `src/infrastructure/di/index.ts`，在 `registerInfrastructure` 函数末尾添加：

```ts
import { ExcelDataSource } from '../datasource/index.js';
import type { IDataSource } from '../../models/domain/interfaces/IDataSource.js';

// 在 registerInfrastructure 函数体内添加:
ctx.singleton<IDataSource>('dataSource', () => new ExcelDataSource());
```

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 4: 提交**

```bash
git add src/infrastructure/datasource/index.ts src/infrastructure/di/index.ts
git commit -m "feat: 注册 dataSource 到 DI 容器"
```

---

### Task 5: 创建 finance-query validator

**Files:**
- Create: `src/models/scenarios/finance-query/validator.ts`

- [ ] **Step 1: 安装依赖**

```bash
npm install alasql
```

- [ ] **Step 2: 编写 3 层校验**

```ts
/**
 * 财务问数 — 3 层校验（SQL 安全 + 数据存在性 + 参数格式）
 */
import type { TableMeta } from '../../domain/interfaces/IDataSource.js';

/** 校验结果 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ══════════════════════════════════════════════
// 1. SQL 安全校验
// ══════════════════════════════════════════════

const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;

export function validateSql(sql: string): ValidationResult {
  if (FORBIDDEN_SQL.test(sql)) {
    const keyword = sql.match(FORBIDDEN_SQL)?.[0];
    return { valid: false, errors: [`禁止执行非查询操作: ${keyword}`] };
  }
  if (!/^\s*SELECT/i.test(sql.trim())) {
    return { valid: false, errors: ['仅允许 SELECT 查询'] };
  }
  return { valid: true, errors: [] };
}

// ══════════════════════════════════════════════
// 2. 数据存在性校验
// ══════════════════════════════════════════════

/** 校验表是否存在 */
export function validateTable(table: string, available: TableMeta[]): ValidationResult {
  const names = available.map((t) => t.name);
  if (!names.includes(table)) {
    return { valid: false, errors: [`表 "${table}" 不存在。可用表: ${names.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}

/** 校验列是否存在 */
export function validateColumns(
  table: string,
  columns: string[],
  schema: TableMeta,
): ValidationResult {
  const validNames = schema.columns.map((c) => c.name);
  const invalid = columns.filter((c) => !validNames.includes(c));
  if (invalid.length > 0) {
    return {
      valid: false,
      errors: [`表 "${table}" 中不存在列: ${invalid.join(', ')}。可用列: ${validNames.join(', ')}`],
    };
  }
  return { valid: true, errors: [] };
}

/** 校验筛选条件中的列是否存在 */
export function validateWhereColumns(
  table: string,
  conditions: Array<{ field: string; op?: string; value: unknown }>,
  schema: TableMeta,
): ValidationResult {
  const errors: string[] = [];
  const validNames = schema.columns.map((c) => c.name);
  for (const cond of conditions) {
    if (!validNames.includes(cond.field)) {
      errors.push(
        `筛选条件中列 "${cond.field}" 不在表 "${table}" 中。可用列: ${validNames.join(', ')}`,
      );
    }
  }
  return { valid: errors.length === 0, errors };
}

// ══════════════════════════════════════════════
// 3. 参数格式校验
// ══════════════════════════════════════════════

const AGG_FNS = ['SUM', 'COUNT', 'AVG', 'MAX', 'MIN'] as const;
const CHART_TYPES = ['pie', 'bar', 'line', 'stacked_bar'] as const;
const SORT_DIRECTIONS = ['asc', 'desc'] as const;
const JOIN_TYPES = ['LEFT', 'RIGHT', 'INNER'] as const;

export interface Metric {
  field: string;
  fn: string;
  alias?: string;
}

export function validateMetric(metric: Metric): ValidationResult {
  if (!metric.field) {
    return { valid: false, errors: ['聚合字段 field 不能为空'] };
  }
  if (!AGG_FNS.includes(metric.fn as typeof AGG_FNS[number])) {
    return { valid: false, errors: [`不支持的聚合函数: ${metric.fn}。可用: ${AGG_FNS.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}

export function validateChartType(type: string): ValidationResult {
  if (!CHART_TYPES.includes(type as typeof CHART_TYPES[number])) {
    return { valid: false, errors: [`不支持的图表类型: ${type}。可用: ${CHART_TYPES.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}

export function validateSortDirection(dir: string): ValidationResult {
  if (!SORT_DIRECTIONS.includes(dir as typeof SORT_DIRECTIONS[number])) {
    return {
      valid: false,
      errors: [`不支持的排序方向: ${dir}。可用: ${SORT_DIRECTIONS.join(', ')}`],
    };
  }
  return { valid: true, errors: [] };
}

export function validateJoinType(type: string): ValidationResult {
  if (!JOIN_TYPES.includes(type as typeof JOIN_TYPES[number])) {
    return { valid: false, errors: [`不支持的连接类型: ${type}。可用: ${JOIN_TYPES.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}
```

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 4: 提交**

```bash
git add src/models/scenarios/finance-query/validator.ts
git commit -m "feat: 创建 finance-query validator — SQL 安全 + 数据存在性 + 参数格式 3 层校验"
```

---

### Task 6: 创建 finance-query tools（连接层 + 查询层）

**Files:**
- Create: `src/models/scenarios/finance-query/tools.ts`

- [ ] **Step 1: 编写 tools.ts（连接层 2 个 + 查询层 4 个）**

```ts
/**
 * 财务问数 — 全部 11 个 Tool 定义
 *
 * 分 4 层: 连接层(2) → 查询层(4) → 计算层(2) → 输出层(1)
 * 通过工厂函数注入 IDataSource，不直接依赖具体实现。
 */
import { Type } from '@earendil-works/pi-ai';
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { IDataSource, TableMeta, QueryResult } from '../../domain/interfaces/IDataSource.js';
import type { ContentBlock } from '../../domain/interfaces/IContentBlock.js';
import {
  validateTable,
  validateColumns,
  validateWhereColumns,
  validateMetric,
  validateChartType,
  validateSortDirection,
  validateJoinType,
} from './validator.js';

// ══════════════════════════════════════════════
// 工厂: 注入 dataSource 创建全部 Tool
// ══════════════════════════════════════════════

let schemaCache: TableMeta[] | null = null;
const getCachedSchema = (): TableMeta[] | null => schemaCache;
const setCachedSchema = (tables: TableMeta[]): void => { schemaCache = tables; };

export function createFinanceQueryTools(dataSource: IDataSource): AgentTool[] {
  // ═══ 连接层 ═══

  /** 加载 Excel 文件并返回表结构 */
  const connectDatasourceTool: AgentTool = {
    name: 'connect_datasource',
    label: '连接数据源',
    description: '加载 Excel 数据文件，返回所有可用表的名称、列结构和行数。所有查询之前必须先调用此工具。',
    parameters: Type.Object({
      filePath: Type.String({ description: 'Excel 文件路径' }),
    }),
    execute: async (_id, params) => {
      const { filePath } = params as { filePath: string };
      const tables = await dataSource.connect(filePath);
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

  // ═══ 查询层 ═══

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

  // ═══ 计算层 (Task 7 中继续) + 输出层 (Task 8) ═══
  // ...
}
```

- [ ] **Step 2: 运行 typecheck（先确保这 6 个 tool 编译通过）**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 3: 提交**

```bash
git add src/models/scenarios/finance-query/tools.ts
git commit -m "feat: 创建 finance-query 连接层(2) + 查询层(4) Tools"
```

---

### Task 7: 补充计算层 + 输出层 Tools

**Files:**
- Modify: `src/models/scenarios/finance-query/tools.ts`

- [ ] **Step 1: 在 tools.ts 计算层 + 输出层 Tool，并完善工厂返回**

在 `createFinanceQueryTools` 函数中，紧接着 sortDataTool 之后追加：

```ts
  // ═══ 计算层 ═══

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

  // ═══ 输出层 ═══

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
    selectDataTool,
    aggregateDataTool,
    joinDataTool,
    sortDataTool,
    // 计算层
    calculateFieldsTool,
    generateCostRateSqlTool,
    // 输出层
    generateChartTool,
    // sql_query (自由 SQL)
    sqlQueryTool,
  ];
```

在 selectDataTool 之前添加 `sqlQueryTool`：

```ts
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
      const result = await dataSource.query(sql);
      const preview = result.rows.slice(0, 20);
      const text = `查询结果 (${result.rowCount} 行, 显示前 ${preview.length} 行):\n${JSON.stringify(preview, null, 2)}`;
      return { content: [{ type: 'text' as const, text }], details: result };
    },
  };
```

- [ ] **Step 2: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 3: 提交**

```bash
git add src/models/scenarios/finance-query/tools.ts
git commit -m "feat: 补充 finance-query 计算层(2) + 输出层(1) + sql_query(1) Tools"
```

---

### Task 8: 创建 prompt + scenario 入口

**Files:**
- Create: `src/models/scenarios/finance-query/prompt.ts`
- Create: `src/models/scenarios/finance-query/index.ts`

- [ ] **Step 1: 编写 prompt.ts**

```ts
/**
 * 财务问数 — System Prompt
 */
export const financeQueryPrompt = `你是一个财务数据分析助手，可以查询 Excel 成本数据、执行计算、生成报表和图表。

## 工作流程
1. 先调用 connect_datasource 加载数据文件，了解有哪些表和列
2. 用 get_schema 查看表结构
3. 用 select_data / aggregate_data / join_data / sort_data 组合查询
4. 需要时用 calculate_fields 计算派生字段
5. 需要生成图表时调用 generate_chart，图表会自动渲染
6. 复杂查询可调用 sql_query 直接执行 SQL

## 规则
- 必须先 connect_datasource，再执行其他操作
- 先用 get_schema 了解列名和类型，再写查询条件
- 计算交给 calculate_fields，不要自己算
- 图表用 generate_chart，不要手动描述数据
- 数据结果用 Markdown 表格展示
- where 条件中字符串要加引号，数字不需要
- 列名用英文原名

## 输出规范
- 用中文回复
- 数据结果优先用 Markdown 表格
- 图表自动通过可视化组件渲染
- 无数据时说明原因并给出建议`;
```

- [ ] **Step 2: 编写 index.ts**

```ts
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
```

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 4: 提交**

```bash
git add src/models/scenarios/finance-query/prompt.ts src/models/scenarios/finance-query/index.ts
git commit -m "feat: 创建 finance-query 场景入口 + System Prompt"
```

---

### Task 9: 注册场景 + 场景文档

**Files:**
- Modify: `src/models/scenarios/registry.ts`
- Create: `src/models/scenarios/finance-query/CLAUDE.md`

- [ ] **Step 1: 注册场景**

修改 `registry.ts`，在 import 区添加：

```ts
import { financeQueryScenario } from './finance-query/index.js';
```

在 registry 对象中添加：

```ts
  // 财务问数 (11 个 Tool、无 HITL)
  finance_query: financeQueryScenario,
```

- [ ] **Step 2: 编写场景 CLAUDE.md**

```md
# 财务问数场景 (finance-query)

> ⬆️ [返回 scenarios/](../CLAUDE.md)

## 目录结构

finance-query/
├── index.ts       # 场景入口
├── tools.ts       # 11 个 Tool（连接/查询/计算/输出）
├── prompt.ts      # System Prompt
└── validator.ts   # 3 层校验

## Tool 列表

| 层 | Tool | 说明 |
|-----|------|------|
| 连接 | connect_datasource | 加载 Excel，返回表结构 |
| 连接 | get_schema | 查看列名+类型 |
| 查询 | select_data | 过滤+投影 |
| 查询 | aggregate_data | GROUP BY 聚合 |
| 查询 | join_data | 表连接 |
| 查询 | sort_data | 排序 |
| 查询 | sql_query | 自由 SQL |
| 计算 | calculate_fields | 派生字段 |
| 计算 | generate_cost_rate_sql | 成本分摊 SQL |
| 输出 | generate_chart | 生成图表 ContentBlock |

## 类型

查询分析型：无表单、无 HITL、无审批流程
```

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 4: 提交**

```bash
git add src/models/scenarios/registry.ts src/models/scenarios/finance-query/CLAUDE.md
git commit -m "feat: 注册 finance-query 场景 + 场景文档"
```

---

### Task 10: agent-factory 添加 content SSE 事件

**Files:**
- Modify: `src/agent/core/agent-factory.ts`
- Modify: `src/agent/core/types.ts` (检查 SSECallback 签名)

- [ ] **Step 1: 在 tool_execution_end 事件处理中提取 ContentBlock**

修改 `agent-factory.ts` 中 `agent.subscribe` 回调内的 `tool_execution_end` case：

```ts
// 旧代码:
case 'tool_execution_end':
  onSSE('tool_result', { tool: event.toolName, error: event.isError });
  break;

// 新代码:
case 'tool_execution_end':
  onSSE('tool_result', { tool: event.toolName, error: event.isError });
  // 提取 tool 结果中的 ContentBlock 并推送
  if (event.result?.details?.blocks) {
    onSSE('content', { blocks: event.result.details.blocks });
  }
  break;
```

- [ ] **Step 2: 确认 SSECallback 类型可用**

`src/agent/core/types.ts` 中 `SSECallback` 从 domain 重导出。确认签名是 `(event: string, data: Record<string, unknown>) => void`。`content` 是新事件类型名，无需修改类型定义。

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 4: 提交**

```bash
git add src/agent/core/agent-factory.ts
git commit -m "feat: agent-factory 支持 content SSE 事件 — tool 结果中的 ContentBlock 自动推送"
```

---

### Task 11: useAgentCore 添加 onContent 回调

**Files:**
- Modify: `src/controllers/hooks/useAgentCore.ts`

- [ ] **Step 1: 在 AgentEvent 联合类型中新增 content 事件**

在 `AgentEvent` 类型中添加：

```ts
  | { type: 'content'; blocks: Array<{ type: string; data: Record<string, unknown> }> };
```

- [ ] **Step 2: 在 handleSSE 中处理 content 事件**

在 `handleSSE` 函数的 switch 中添加：

```ts
    case 'content':
      // ContentBlock SSE 事件 → 转发给 onEvent
      onEvent({ type: 'content', blocks: data.blocks as Array<{ type: string; data: Record<string, unknown> }> });
      break;
```

- [ ] **Step 3: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 4: 提交**

```bash
git add src/controllers/hooks/useAgentCore.ts
git commit -m "feat: useAgentCore 新增 content 事件 — 转发 ContentBlock 到 UI"
```

---

### Task 12: useAgent 处理 content 事件

**Files:**
- Modify: `src/controllers/hooks/useAgent.ts`
- Modify: `src/views/types.ts` (如果需要)

- [ ] **Step 1: 在 useAgent 状态中添加 contentBlocks**

在 `useAgent` 函数的 state 区添加：

```ts
  const [contentBlocks, setContentBlocks] = useState<Array<{ type: string; data: Record<string, unknown> }>>([]);
```

- [ ] **Step 2: 在 onEvent 回调中处理 content 事件**

在 `ensureSession` 的 `onEvent` switch 中添加：

```ts
          case 'content':
            setContentBlocks(event.blocks);
            break;
```

- [ ] **Step 3: 导出 contentBlocks**

在 return 对象中添加：

```ts
    contentBlocks,
```

- [ ] **Step 4: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 5: 提交**

```bash
git add src/controllers/hooks/useAgent.ts
git commit -m "feat: useAgent 新增 contentBlocks 状态 — 接收 ContentBlock 渲染数据"
```

---

### Task 13: 创建 ContentRenderer 组件

**Files:**
- Create: `src/views/components/content-renderer/index.tsx`
- Create: `src/views/components/content-renderer/ChartBlock.tsx`
- Create: `src/views/components/content-renderer/TableBlock.tsx`
- Create: `src/views/components/content-renderer/CardBlock.tsx`

- [ ] **Step 1: 安装 ECharts 依赖**

```bash
npm install echarts echarts-for-react
```

- [ ] **Step 2: 编写 ContentRenderer 注册表**

```tsx
/**
 * ContentRenderer — 通用内容块渲染器
 *
 * 按 ContentBlock.type 匹配注册的渲染器，支持按需扩展。
 * 新增可视化类型只需 register('newType', Component)。
 */
import type { ReactNode } from 'react';
import { ChartBlock } from './ChartBlock';
import { TableBlock } from './TableBlock';
import { CardBlock } from './CardBlock';

/** 单个块渲染器签名 */
type BlockRenderer = (data: Record<string, unknown>) => ReactNode;

/** 全局渲染注册表 */
const renderers: Record<string, BlockRenderer> = {
  chart: ChartBlock,
  table: TableBlock,
  card: CardBlock,
};

/** 注册新渲染器 */
export function registerBlockRenderer(type: string, renderer: BlockRenderer): void {
  renderers[type] = renderer;
}

/** ContentBlock 数据 */
export interface ContentBlockData {
  type: string;
  data: Record<string, unknown>;
}

/** ContentRenderer 组件属性 */
interface ContentRendererProps {
  blocks: ContentBlockData[];
}

/** 按序渲染所有内容块 */
export function ContentRenderer({ blocks }: ContentRendererProps) {
  if (!blocks || blocks.length === 0) return null;

  return (
    <div className="content-renderer">
      {blocks.map((block, i) => {
        const Renderer = renderers[block.type];
        if (!Renderer) {
          console.warn(`[ContentRenderer] 未注册的块类型: ${block.type}`);
          return null;
        }
        return <div key={`${block.type}-${i}`} className={`content-block content-block-${block.type}`}>
          {Renderer(block.data)}
        </div>;
      })}
    </div>
  );
}
```

- [ ] **Step 3: 编写 ChartBlock**

```tsx
/**
 * ChartBlock — ECharts 图表渲染器
 */
import ReactECharts from 'echarts-for-react';

interface ChartBlockData {
  chartType?: string;
  title?: string;
  labels?: string[];
  values?: number[];
}

export function ChartBlock(data: Record<string, unknown>) {
  const { chartType = 'bar', title = '', labels = [], values = [] } = data as ChartBlockData;

  const option = {
    title: { text: title, left: 'center' },
    tooltip: {},
    xAxis: chartType === 'bar' || chartType === 'line' || chartType === 'stacked_bar'
      ? { type: 'category', data: labels }
      : undefined,
    yAxis: chartType !== 'pie' ? { type: 'value' } : undefined,
    series: [{
      name: title,
      type: chartType === 'stacked_bar' ? 'bar' : chartType,
      data: values,
      stack: chartType === 'stacked_bar' ? 'total' : undefined,
      radius: chartType === 'pie' ? ['40%', '70%'] : undefined,
    }],
  };

  return <ReactECharts option={option} style={{ height: 400 }} />;
}
```

- [ ] **Step 4: 编写 TableBlock**

```tsx
/**
 * TableBlock — 数据表格渲染器
 */
interface TableBlockData {
  columns?: string[];
  rows?: Record<string, unknown>[];
}

export function TableBlock(data: Record<string, unknown>) {
  const { columns = [], rows = [] } = data as TableBlockData;

  if (rows.length === 0) return <p className="text-muted">无数据</p>;

  return (
    <div className="overflow-x-auto">
      <table className="content-table">
        <thead>
          <tr>
            {columns.map((col) => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, i) => (
            <tr key={i}>
              {columns.map((col) => <td key={col}>{String(row[col] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && <p className="text-muted">显示前 50 行，共 {rows.length} 行</p>}
    </div>
  );
}
```

- [ ] **Step 5: 编写 CardBlock**

```tsx
/**
 * CardBlock — 卡片列表渲染器
 */
interface CardBlockData {
  title?: string;
  items?: Array<{ label: string; value: unknown }>;
}

export function CardBlock(data: Record<string, unknown>) {
  const { title, items = [] } = data as CardBlockData;

  return (
    <div className="content-cards">
      {title && <h4 className="content-cards-title">{title}</h4>}
      <div className="content-cards-grid">
        {items.map((item, i) => (
          <div key={i} className="content-card">
            <span className="content-card-label">{item.label}</span>
            <span className="content-card-value">{String(item.value ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: 运行 typecheck**

```bash
npm run typecheck
```
预期: PASS

- [ ] **Step 7: 提交**

```bash
git add src/views/components/content-renderer/ package.json package-lock.json
git commit -m "feat: 创建 ContentRenderer — 注册表模式 + ChartBlock/TableBlock/CardBlock"
```

---

### Task 14: 在聊天界面集成 ContentRenderer

**Files:**
- Modify: 聊天气泡组件（需先确认具体文件路径）

- [ ] **Step 1: 找到聊天消息渲染组件**

```bash
grep -r "assistant" src/views/components/ --include="*.tsx" -l
```

- [ ] **Step 2: 在 assistant 消息气泡底部添加 ContentRenderer**

在 assistant 消息渲染处（该消息关联的 contentBlocks 不为空时），组件下方插入：

```tsx
import { ContentRenderer } from '../content-renderer';
import type { ContentBlockData } from '../content-renderer';

// 在消息气泡内:
{message.contentBlocks && message.contentBlocks.length > 0 && (
  <ContentRenderer blocks={message.contentBlocks as ContentBlockData[]} />
)}
```

- [ ] **Step 3: 消息类型扩展**

在 `Message` 类型（`src/views/types.ts`）中添加可选字段：

```ts
  contentBlocks?: Array<{ type: string; data: Record<string, unknown> }>;
```

- [ ] **Step 4: 运行 typecheck + dev 验证**

```bash
npm run typecheck && npm run dev
```
手动验证: content 事件 → ContentRenderer 渲染图表/表格

- [ ] **Step 5: 提交**

```bash
git add src/views/components/chat/ src/views/types.ts
git commit -m "feat: 聊天气泡集成 ContentRenderer — assistant 消息支持图表/表格/卡片渲染"
```

---

### Task 15: 最终验证 + 文档更新

**Files:**
- Modify: `src/models/CLAUDE.md`
- Modify: `src/models/scenarios/CLAUDE.md`
- Modify: `src/controllers/CLAUDE.md`
- Modify: `src/views/CLAUDE.md`

- [ ] **Step 1: 更新各层 CLAUDE.md**

分别在对应文档中：
- `models/CLAUDE.md` — 架构图中新增加 finance-query 场景节点
- `models/scenarios/CLAUDE.md` — 场景表新增加 finance-query 行
- `controllers/CLAUDE.md` — 数据流图中标注 content SSE 事件
- `views/CLAUDE.md` — 组件列表新增 content-renderer/

- [ ] **Step 2: 全量验证**

```bash
npm run typecheck
npm run dev
```
手动回归: 发送消息 → 流式响应 → 切换 finance-query 场景 → 查询数据 → 图表渲染

- [ ] **Step 3: 提交**

```bash
git add src/models/CLAUDE.md src/models/scenarios/CLAUDE.md src/controllers/CLAUDE.md src/views/CLAUDE.md
git commit -m "docs: 更新 CLAUDE.md 反映 finance-query 场景 + ContentRenderer 架构"
```

---

## 阶段总结

| 阶段 | 任务 | 说明 |
|------|------|------|
| 1 — 领域类型 | Task 1-2 | IDataSource + IContentBlock 接口 |
| 2 — 数据源 | Task 3-4 | ExcelDataSource + DI 注册 |
| 3 — 场景 | Task 5-9 | validator + tools + prompt + index + registry + CLAUDE.md |
| 4 — SSE | Task 10 | agent-factory content 事件 |
| 5 — 前端 | Task 11-14 | useAgentCore → useAgent → ContentRenderer → 聊天集成 |
| 6 — 文档 | Task 15 | CLAUDE.md 更新 + 全量验证 |

**依赖安装汇总** (在 Task 3 + Task 13):
```bash
npm install xlsx alasql echarts echarts-for-react
```
