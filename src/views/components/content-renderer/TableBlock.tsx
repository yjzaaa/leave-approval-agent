/**
 * TableBlock — 数据表格渲染器
 *
 * 接收 columns + rows，渲染为 HTML 表格。
 * 超过 50 行时截断显示并提示总行数。
 */
interface TableBlockData {
  columns?: string[];
  rows?: Record<string, unknown>[];
}

export function TableBlock(data: Record<string, unknown>) {
  const { columns = [], rows = [] } = data as TableBlockData;

  if (rows.length === 0) return <p className="text-sm text-muted-foreground italic px-2">无数据</p>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            {columns.map((col) => <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row, i) => (
            <tr key={i} className="border-t border-border/50 hover:bg-muted/30 transition-colors">
              {columns.map((col) => <td key={col} className="px-3 py-1.5 whitespace-nowrap">{String(row[col] ?? '')}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 50 && (
        <div className="px-3 py-2 text-xs text-muted-foreground border-t border-border bg-muted/30">
          显示前 50 行，共 {rows.length} 行
        </div>
      )}
    </div>
  );
}
