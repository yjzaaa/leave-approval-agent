/** 数据源接口 — 抽象数据查询能力 */

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
