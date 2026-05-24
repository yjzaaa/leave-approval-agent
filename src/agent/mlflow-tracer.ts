/**
 * MLflow Tracing 集成层
 *
 * 基于 @mlflow/core 官方 TypeScript SDK。
 * 环境变量 MLFLOW_TRACKING_URI 控制启用/禁用（不设则 no-op）。
 */
import {
  init, withSpan, updateCurrentTrace, flushTraces,
  SpanType,
} from '@mlflow/core';
import type { LiveSpan } from '@mlflow/core';

const TRACKING_URI = process.env.MLFLOW_TRACKING_URI;
let initialized = false;

/** 初始化 MLflow（仅一次） */
function ensureInit() {
  if (initialized) return;
  if (!TRACKING_URI) return;
  try {
    init({
      trackingUri: TRACKING_URI,
      experimentId: process.env.MLFLOW_EXPERIMENT_ID || '0',
    });
    initialized = true;
    console.log(`[MLflow] tracing → ${TRACKING_URI}`);
  } catch (e) {
    console.warn('[MLflow] init failed:', (e as Error).message);
  }
}

/** MLflow 是否可用 */
export function isEnabled(): boolean {
  return !!TRACKING_URI;
}

/** 追踪一次完整对话请求 */
export async function traceChatRequest(
  metadata: { plugin: string; userId?: string; message: string },
  fn: () => Promise<void>,
): Promise<void> {
  if (!TRACKING_URI) { return fn(); }
  ensureInit();
  if (!initialized) { return fn(); }

  try {
    await withSpan(
      async (_span: LiveSpan) => {
        await fn();
      },
      {
        name: metadata.plugin,
        spanType: SpanType.CHAIN,
        attributes: {
          plugin: metadata.plugin,
          userId: metadata.userId || 'anonymous',
          messagePreview: metadata.message.slice(0, 100),
        },
      },
    );
    await flushTraces();
  } catch (e) {
    console.warn('[MLflow] trace error:', (e as Error).message);
  }
}

/** 创建子 span */
export async function traceSpan<T>(
  name: string,
  attrs: Record<string, unknown>,
  fn: (span: LiveSpan) => Promise<T>,
): Promise<T> {
  if (!TRACKING_URI || !initialized) return fn(null as unknown as LiveSpan);
  try {
    return await withSpan(
      async (span: LiveSpan) => fn(span),
      { name, spanType: SpanType.TOOL, attributes: attrs },
    );
  } catch (e) {
    console.warn('[MLflow] span error:', (e as Error).message);
    return fn(null as unknown as LiveSpan);
  }
}
