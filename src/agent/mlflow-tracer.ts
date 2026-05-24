/**
 * MLflow Tracing 集成 — Pi Agent Instrumentation
 *
 * 单一类封装全部 tracing 逻辑，通过 handleEvent() 钩子接收 agent 事件。
 * 无 MLFLOW_TRACKING_URI 时完全 no-op。
 *
 * 注意: 本模块仅在 Node.js 服务端使用，浏览器 local 模式不实例化 tracer。
 *
 * Trace 结构:
 *   CHAIN: chat:{plugin}           ← withSpan（根 span）
 *     └── TOOL: tool:{name}        ← startSpan（嵌套子 span）
 */
import {
  init, withSpan, startSpan, updateCurrentTrace, flushTraces,
  SpanType, SpanStatusCode,
} from '@mlflow/core';
import type { LiveSpan } from '@mlflow/core';

const TRACKING_URI = process.env.MLFLOW_TRACKING_URI;
let initialized = false;

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

export interface TracerOptions {
  plugin: string;
  userId?: string;
  sessionId?: string;
  message: string;
}

/**
 * PiAgentTracer — 一次请求一个实例
 *
 * 用法:
 *   const tracer = new PiAgentTracer(opts);
 *   await tracer.run(async () => {
 *     agent.subscribe(e => tracer.handleEvent(e));
 *     await agent.prompt(msg);
 *     await agent.waitForIdle();
 *   });
 */
export class PiAgentTracer {
  private readonly enabled: boolean;
  private rootSpan: LiveSpan | null = null;
  private toolSpans = new Map<string, LiveSpan>();
  private toolTimings = new Map<string, number>();

  private responseText = '';
  private tools: Array<{ name: string; ms: number; error: boolean }> = [];
  private hitlTriggered = false;
  private hitlTool = '';

  constructor(private readonly opts: TracerOptions) {
    this.enabled = !!TRACKING_URI;
  }

  /** 执行完整 trace 生命周期 */
  async run(fn: () => Promise<void>): Promise<void> {
    if (!this.enabled) return fn();
    ensureInit();
    if (!initialized) return fn();

    try {
      await withSpan(
        async (span: LiveSpan) => {
          this.rootSpan = span;
          await fn();
          this.flushMetadata();
        },
        {
          name: `chat:${this.opts.plugin}`,
          spanType: SpanType.CHAIN,
          attributes: {
            plugin: this.opts.plugin,
            userId: this.opts.userId || 'anonymous',
            sessionId: this.opts.sessionId || '',
            messageLength: this.opts.message.length,
            messagePreview: this.opts.message.slice(0, 200),
          },
        },
      );
      await flushTraces();
    } catch (e) {
      console.warn('[MLflow] trace error:', (e as Error).message);
      try { await flushTraces(); } catch {}
    }
  }

  /** 接收 agent 事件 */
  handleEvent(event: any): void {
    if (!this.enabled || !this.rootSpan) return;

    try {
      switch (event.type) {
        case 'tool_execution_start': {
          this.toolTimings.set(event.toolName, Date.now());

          const toolSpan = startSpan({
            name: `tool:${event.toolName}`,
            spanType: SpanType.TOOL,
            parent: this.rootSpan,
            attributes: {
              'tool.name': event.toolName,
              'tool.args': JSON.stringify((event as any).args ?? {}),
            },
          });
          this.toolSpans.set(event.toolName, toolSpan);
          break;
        }

        case 'tool_execution_end': {
          const span = this.toolSpans.get(event.toolName);
          const startMs = this.toolTimings.get(event.toolName) ?? 0;
          const duration = startMs ? Date.now() - startMs : 0;

          if (span) {
            span.end({
              attributes: { 'tool.duration_ms': duration },
              status: event.isError ? SpanStatusCode.ERROR : SpanStatusCode.OK,
            });
            this.toolSpans.delete(event.toolName);
          }

          this.tools.push({ name: event.toolName, ms: duration, error: !!event.isError });
          this.toolTimings.delete(event.toolName);
          break;
        }

        case 'message_update': {
          if (event.assistantMessageEvent?.type === 'text_delta') {
            this.responseText += event.assistantMessageEvent.delta;
          }
          break;
        }
      }
    } catch (e) {
      console.warn('[MLflow] handleEvent error:', (e as Error).message);
    }
  }

  /** 标记 HITL 触发 */
  markHitl(toolName: string): void {
    this.hitlTriggered = true;
    this.hitlTool = toolName;
  }

  /** 写入 trace metadata（必须在 withSpan 内调用） */
  private flushMetadata(): void {
    const tags: Record<string, string> = {
      plugin: this.opts.plugin,
      userId: this.opts.userId || 'anonymous',
    };
    if (this.opts.sessionId) tags['sessionId'] = this.opts.sessionId;

    const toolNames = this.tools.map(t => t.name).join(',') || 'none';
    const toolTimings = this.tools.map(t => `${t.name}:${t.ms}ms`).join(';') || 'none';
    const toolErrors = this.tools.filter(t => t.error).map(t => t.name).join(',') || 'none';

    updateCurrentTrace({
      tags,
      metadata: {
        'response.length': String(this.responseText.length),
        'response.preview': this.responseText.slice(0, 200),
        'tool.count': String(this.tools.length),
        'tool.names': toolNames,
        'tool.timings': toolTimings,
        'tool.errors': toolErrors,
        'hitl.triggered': String(this.hitlTriggered),
        'hitl.tool': this.hitlTool || 'none',
      },
      requestPreview: this.opts.message.slice(0, 100),
      responsePreview: this.responseText.slice(0, 100),
      clientRequestId: this.opts.sessionId,
    });
  }
}
