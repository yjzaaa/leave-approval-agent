/**
 * ContentRenderer — 通用内容块渲染器
 *
 * 注册表模式：按 ContentBlock.type 匹配注册的渲染器，支持按需扩展。
 * 新增可视化类型只需 registerBlockRenderer('newType', Component)。
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
    <div className="content-renderer flex flex-col gap-4 mt-3">
      {blocks.map((block, i) => {
        const Renderer = renderers[block.type];
        if (!Renderer) {
          console.warn(`[ContentRenderer] 未注册的块类型: ${block.type}`);
          return null;
        }
        return (
          <div key={`${block.type}-${i}`} className={`content-block content-block-${block.type}`}>
            {Renderer(block.data)}
          </div>
        );
      })}
    </div>
  );
}
