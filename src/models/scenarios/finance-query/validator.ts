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

/** 校验 SQL — 仅允许 SELECT，禁止 DDL/DML */
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

/** 聚合指标定义 */
export interface Metric {
  field: string;
  fn: string;
  alias?: string;
}

/** 校验聚合指标 */
export function validateMetric(metric: Metric): ValidationResult {
  if (!metric.field) {
    return { valid: false, errors: ['聚合字段 field 不能为空'] };
  }
  if (!(AGG_FNS as readonly string[]).includes(metric.fn)) {
    return { valid: false, errors: [`不支持的聚合函数: ${metric.fn}。可用: ${AGG_FNS.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}

/** 校验图表类型 */
export function validateChartType(type: string): ValidationResult {
  if (!(CHART_TYPES as readonly string[]).includes(type)) {
    return { valid: false, errors: [`不支持的图表类型: ${type}。可用: ${CHART_TYPES.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}

/** 校验排序方向 */
export function validateSortDirection(dir: string): ValidationResult {
  if (!(SORT_DIRECTIONS as readonly string[]).includes(dir)) {
    return {
      valid: false,
      errors: [`不支持的排序方向: ${dir}。可用: ${SORT_DIRECTIONS.join(', ')}`],
    };
  }
  return { valid: true, errors: [] };
}

/** 校验连接类型 */
export function validateJoinType(type: string): ValidationResult {
  if (!(JOIN_TYPES as readonly string[]).includes(type)) {
    return { valid: false, errors: [`不支持的连接类型: ${type}。可用: ${JOIN_TYPES.join(', ')}`] };
  }
  return { valid: true, errors: [] };
}
