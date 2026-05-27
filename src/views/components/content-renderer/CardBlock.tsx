/**
 * CardBlock — 卡片列表渲染器
 *
 * 渲染 label-value 键值对卡片网格，适合展示汇总指标。
 */
interface CardBlockData {
  title?: string;
  items?: Array<{ label: string; value: unknown }>;
}

export function CardBlock(data: Record<string, unknown>) {
  const { title, items = [] } = data as CardBlockData;

  if (items.length === 0) return null;

  return (
    <div className="content-cards">
      {title && <h4 className="text-sm font-medium text-foreground mb-2">{title}</h4>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={i} className="bg-muted/40 rounded-xl px-4 py-3 border border-border/50">
            <span className="block text-xs text-muted-foreground mb-0.5">{item.label}</span>
            <span className="block text-base font-semibold text-foreground">{String(item.value ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
