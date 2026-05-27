/**
 * Excel 数据源 — 使用 xlsx 读取 Excel，alasql 执行 SQL 查询
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import alasql from 'alasql';
import type { IDataSource, TableMeta, QueryResult } from '../../models/domain/interfaces/IDataSource.js';

/** 禁止的 DDL/DML 关键字 */
const FORBIDDEN_SQL = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE)\b/i;

/** SQL 保留字 — 作为列名时自动重命名为 Column_xxx 避免解析冲突 */
const SQL_RESERVED_COLUMNS = new Set([
  'Key', 'Function', 'Order', 'Group', 'Index', 'Table', 'Column',
]);

/** Excel 数据源实现 */
export class ExcelDataSource implements IDataSource {
  private loaded = false;
  /** sheet 原名 → 清理后表名的映射 */
  private tableNameMap: Record<string, string> = {};
  /** 原列名 → 清理后列名的映射（跨所有表共享） */
  private columnNameMap: Record<string, string> = {};

  /** 将 sheet 名清理为合法的 SQL 表名（去空格、特殊字符） */
  private sanitizeName(sheetName: string): string {
    return sheetName.replace(/[^a-zA-Z0-9_一-龥]/g, '_').replace(/^(\d)/, '_$1');
  }

  /** 从 Excel 文件加载所有 sheet 到 alasql 内存表 */
  async connect(filePath: string): Promise<TableMeta[]> {
    const workbook = XLSX.readFile(filePath);
    const tables: TableMeta[] = [];
    this.tableNameMap = {};
    this.columnNameMap = {};

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null }) as Record<string, unknown>[];

      if (jsonData.length === 0) continue;

      // 重命名 SQL 保留字列名（如 Key → Column_Key）
      if (jsonData.length > 0) {
        const firstRow = jsonData[0];
        for (const col of Object.keys(firstRow)) {
          if (SQL_RESERVED_COLUMNS.has(col) && !this.columnNameMap[col]) {
            this.columnNameMap[col] = `Column_${col}`;
          }
        }
        // 实际重命名行数据中的 key
        if (Object.keys(this.columnNameMap).length > 0) {
          for (const row of jsonData) {
            for (const [oldCol, newCol] of Object.entries(this.columnNameMap)) {
              if (oldCol in row) {
                row[newCol] = row[oldCol];
                delete row[oldCol];
              }
            }
          }
        }
      }

      // 推断列类型（基于前 100 行采样）
      const sample = jsonData.slice(0, 100);
      const columns = Object.keys(jsonData[0]).map((name) => {
        const allNumbers = sample.every((row: Record<string, unknown>) => {
          const v = row[name];
          return v === null || v === undefined || typeof v === 'number' || (!isNaN(Number(v)) && v !== '');
        });
        const allDates = sample.every((row: Record<string, unknown>) => {
          const v = row[name];
          if (v === null || v === undefined) return true;
          if (typeof v === 'number' && v > 40000 && v < 60000) return true;
          return !isNaN(Date.parse(String(v)));
        });
        return {
          name,
          type: (allDates && !allNumbers ? 'date' : allNumbers ? 'number' : 'string') as 'string' | 'number' | 'date',
        };
      });

      // 清理表名（去空格和特殊字符，避免 SQL 解析问题）
      const cleanName = this.sanitizeName(sheetName);
      this.tableNameMap[sheetName] = cleanName;

      // 导入到 alasql（如果表已存在则复用，避免重复 CREATE TABLE 报错）
      if (!alasql.tables[cleanName]) {
        alasql(`CREATE TABLE [${cleanName}]`);
      }
      alasql.tables[cleanName].data = jsonData;

      tables.push({ name: sheetName, columns, rowCount: jsonData.length });
    }

    this.loaded = true;
    return tables;
  }

  /** 执行 SELECT 查询，自动将原表名/保留字替换为合法形式 */
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

    // 将 SQL 中的原表名替换为清理后的表名
    let translatedSql = sql;
    for (const [original, clean] of Object.entries(this.tableNameMap)) {
      if (original === clean) continue;
      translatedSql = translatedSql.replaceAll(`[${original}]`, `[${clean}]`);
      const regex = new RegExp(`(?<![\\w一-龥])${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\w一-龥])`, 'g');
      translatedSql = translatedSql.replace(regex, clean);
    }

    // 将 SQL 中引用到的保留字列名替换为实际存储的列名
    // （connect 时将 Key → Column_Key，此处反向翻译 SQL 中的 [Key] / table.[Key]）
    for (const [original, clean] of Object.entries(this.columnNameMap)) {
      // [Key] → [Column_Key]（方括号形式）
      translatedSql = translatedSql.replaceAll(`[${original}]`, `[${clean}]`);
      // table.[Key] → table.[Column_Key] 中的 [Key] 已被上面 replaceAll 覆盖，但
      // 对于 table.Key（无方括号）的情况仍需处理：\b 确保不误改字符串字面量
      const wordRegex = new RegExp(`\\b${original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');
      translatedSql = translatedSql.replace(wordRegex, clean);
    }

    const rows = alasql(translatedSql) as Record<string, unknown>[];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return { columns, rows, rowCount: rows.length, sql: translatedSql };
  }
}
