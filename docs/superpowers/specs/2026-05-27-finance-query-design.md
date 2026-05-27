# 财务问数系统场景设计

> 日期: 2026-05-27 | 状态: 待实现

## 概述

在当前项目中新增 `finance-query` 场景，复刻 AI2 项目的财务问数功能。场景采用单 Agent + 组合 Tool 架构，通过通用 ContentBlock 协议支持前端自由渲染图表/表格/卡片等可视化内容。

## IDataSource 数据源接口

```ts
// models/domain/interfaces/IDataSource.ts

/** 列元数据 */
interface ColumnMeta {
  name: string;
  type: 'string' | 'number' | 'date';
}

/** 表元数据 */
interface TableMeta {
  name: string;
  columns: ColumnMeta[];
  rowCount: number;
}

/** 查询结果 */
interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  sql: string;
}

/** 数据源接口 */
interface IDataSource {
  connect(filePath: string): Promise<TableMeta[]>;
  query(sql: string): Promise<QueryResult>;
}
```

- `connect()` — 加载数据文件，返回表列表 + 列元数据
- `query()` — 执行 SELECT 查询，禁止 DDL/DML
- 接口放 `domain/` 层，零外部依赖，方便后续切换数据源

**Excel 实现**（`infrastructure/datasource/excel-source.ts`）:
- 用 `xlsx` 库读取 Excel 文件
- 用 `alasql` 对加载的数据执行 SQL
- 自动识别列类型（基于前 100 行采样）

## ContentBlock 通用渲染协议

### 协议定义

```ts
// models/domain/interfaces/IContentBlock.ts

interface ContentBlock {
  type: string;                    // 块类型标识: "chart" | "table" | "card" | "list" | ...
  data: Record<string, unknown>;   // 类型特定的 payload
}
```

### 传输方式 — SSE `content` 事件

在现有 SSE 事件体系旁新增：

```
event: text      data: {"content": "根据数据..."}
event: content   data: {"blocks": [{"type":"chart","data":{...}}, {"type":"table","data":{...}}]}
event: text      data: {"content": "以上是分析结果"}
event: done      data: {}
```

Tool 执行完毕后自动产出 ContentBlock 数组，通过 SSE `content` 事件发送到前端。

### 前端渲染 — 注册表模式

```ts
// views/components/content-renderer/

type BlockRenderer = (data: Record<string, unknown>) => ReactNode;

const renderers: Record<string, BlockRenderer> = {
  chart: ChartBlock,
  table: TableBlock,
  card:  CardBlock,
};
```

- `ContentRenderer` 组件遍历 `blocks[]`，按 `type` 匹配渲染器
- 新增可视化类型只需 `register('newType', Component)`
- 初始内置: `chart`(ECharts), `table`(排序表格), `card`(卡片列表)

### useAgentCore 改动

新增 `onContent` 回调：

```ts
// controllers/hooks/useAgentCore.ts
onContent?: (blocks: ContentBlock[]) => void;
```

## 场景 Tools（11 个，分 4 层）

### 连接层（2 个）

| Tool | 参数 | 返回 | 说明 |
|------|------|------|------|
| `connect_datasource` | `filePath: string` | `{tables: TableMeta[], message: string}` | 加载 Excel，返回可用表列表 |
| `get_schema` | `tableName?: string` | `{tables: TableMeta[]}` | 获取表结构（列名+类型+示例值） |

### 查询层（4 个）

| Tool | 参数 | 返回 | 说明 |
|------|------|------|------|
| `select_data` | `table, columns?, where?, limit?, offset?` | `QueryResult` | 行过滤+列投影 |
| `aggregate_data` | `table, groupBy, metrics[]` | `QueryResult` | GROUP BY + SUM/COUNT/AVG/MAX/MIN |
| `join_data` | `leftTable, rightTable, on[], type?` | `QueryResult` | LEFT/RIGHT/INNER JOIN |
| `sort_data` | `sortBy[], direction?` | `QueryResult` | 对结果排序 |

其中 `metrics` 类型:
```ts
{ field: string, fn: 'SUM' | 'COUNT' | 'AVG' | 'MAX' | 'MIN', alias?: string }
```

### 计算层（2 个）

| Tool | 参数 | 返回 | 说明 |
|------|------|------|------|
| `calculate_fields` | `expressions[]` | `QueryResult` | 派生字段计算（如 `amount * rate`） |
| `generate_cost_rate_sql` | `year, scenario, func, cc?` | `{sql: string, params: Record<string,string>}` | 成本分摊 SQL 模板 |

### 输出层（1 个）

| Tool | 参数 | 返回 | 说明 |
|------|------|------|------|
| `generate_chart` | `type, title, labels, values` | `ContentBlock[]` | pie/bar/line/stacked_bar |

## Tool 参数校验（3 层）

所有 Tool 执行前先调对应校验，失败时返回结构化的错误 + 修复建议。

### 1. SQL 安全校验

```ts
// models/scenarios/finance-query/validator.ts

/** 禁止的 DDL/DML 关键字 */
const FORBIDDEN_SQL = /INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE/i;

/** 校验 SQL — 仅允许 SELECT，禁止修改操作 */
function validateSql(sql: string): ValidationResult
```

### 2. 数据存在性校验

| 校验函数 | 触发条件 | 错误建议 |
|---------|---------|---------|
| `validateTable(table, available)` | `select_data` / `aggregate_data` / `join_data` | 列出可用表名 |
| `validateColumns(table, columns, schema)` | `select_data` 指定列时 | 列出表中实际列名 |
| `validateDomainValues(table, conditions, sample)` | `where` 条件值不在已知域值中 | 列出相近值（编辑距离） |

### 3. 参数格式校验

| 校验函数 | 触发 Tool | 规则 |
|---------|----------|------|
| `validateMetric(metric)` | `aggregate_data` | `fn` 在白名单 `[SUM,COUNT,AVG,MAX,MIN]`，`field` 非空 |
| `validateChartType(type)` | `generate_chart` | 在白名单 `[pie,bar,line,stacked_bar]` |
| `validateSortDirection(dir)` | `sort_data` | `asc` 或 `desc` |
| `validateJoinType(type)` | `join_data` | `LEFT` / `RIGHT` / `INNER` |

## System Prompt 结构

```
你是一个财务数据分析助手，可以查询 Excel 成本数据、执行计算、生成报表和图表。

## 可用工具
{工具列表自动注入 — 由 Pi Agent 处理}

## 工作流程
1. 先调用 connect_datasource 加载数据文件
2. 用 get_schema 了解表结构
3. 用 select_data / aggregate_data / join_data 组合查询
4. 需要时用 calculate_fields 计算派生字段
5. 最后用 generate_chart 输出图表

## 规则
- 必须先 connect，再查询
- 先 get_schema 了解列名，再写查询条件
- 计算交给 Tool，不要自己算
- 图表后不要手动描述数据，ContentBlock 会自动渲染

## 输出规范
- 用中文回复
- 数据结果用 Markdown 表格
- 图表自动通过 content 事件渲染，无需手动处理
```

**建议语**:
- `"查询 2025 年 IT 部门成本分配"`
- `"对比各部门近两年费用变化"`
- `"分析项目成本分摊率并生成饼图"`

## 场景类型

`finance-query` 属于**查询分析**类型：
- `fields`: 无（不需要填表）
- `validate`: 无
- `confirmTools`: 无（非审批场景，无 HITL）
- `submitApi` / `startProcessApi`: 无

## 依赖注入

`IDataSource` 通过 DI 容器注入：

```ts
// infrastructure/di/index.ts 的 registerInfrastructure 中新增
ctx.singleton<IDataSource>('dataSource', () => new ExcelDataSource());
```

Tool 通过 `ctx.get<IDataSource>('dataSource')` 获取实例，不直接 import 具体实现。

## 产物清单

| 层 | 文件 | 内容 |
|------|------|------|
| domain | `models/domain/interfaces/IDataSource.ts` | IDataSource 接口 |
| domain | `models/domain/interfaces/IContentBlock.ts` | ContentBlock 接口 |
| infrastructure | `infrastructure/datasource/excel-source.ts` | ExcelDataSource 实现 |
| infrastructure | `infrastructure/datasource/index.ts` | 汇总导出 |
| infrastructure | `infrastructure/di/index.ts` | 注册 dataSource 到容器 |
| models | `models/scenarios/finance-query/tools.ts` | 11 个 Tool |
| models | `models/scenarios/finance-query/validator.ts` | 3 层参数校验 |
| models | `models/scenarios/finance-query/prompt.ts` | System Prompt |
| models | `models/scenarios/finance-query/index.ts` | 场景入口 |
| models | `models/scenarios/finance-query/CLAUDE.md` | 场景文档 |
| models | `models/scenarios/registry.ts` | 注册 finance-query |
| controllers | `controllers/hooks/useAgentCore.ts` | 新增 onContent 回调 + content SSE 事件处理 |
| views | `views/components/content-renderer/index.ts` | ContentRenderer 组件 |
| views | `views/components/content-renderer/ChartBlock.tsx` | ECharts 块渲染器 |
| views | `views/components/content-renderer/TableBlock.tsx` | 表格块渲染器 |
| views | `views/components/content-renderer/CardBlock.tsx` | 卡片块渲染器 |
| views | `views/components/chat/` | 在对话气泡中集成 ContentRenderer |
| deps | `package.json` | 新增: `xlsx`, `alasql`, `echarts` |
