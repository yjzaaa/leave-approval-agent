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
          if (typeof v === 'number' && v > 40000 && v < 60000) return true;
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
