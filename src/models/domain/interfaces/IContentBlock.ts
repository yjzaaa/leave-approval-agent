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
