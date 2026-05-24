/**
 * MLflow Tracing 集成 — Pi Agent Instrumentation
 *
 * 纯 fetch() REST API 实现，零 SDK 依赖。
 * 支持 Node.js 和浏览器双环境运行。
 *
 * 无 MLFLOW_TRACKING_URI 时完全 no-op。
 *
 * Trace 结构:
 *   CHAIN: chat:{plugin}           ← root span
 *     └── TOOL: tool:{name}        ← child span
 */
const TRACKING_URI: string =
  typeof process !== 'undefined' && process.env?.MLFLOW_TRACKING_URI
    ? process.env.MLFLOW_TRACKING_URI
    : '';

const EXPERIMENT_ID: string =
  typeof process !== 'undefined' && process.env?.MLFLOW_EXPERIMENT_ID
    ? process.env.MLFLOW_EXPERIMENT_ID
    : '0';

const TIMEOUT_MS = 2000;

// ═══ ID 生成 (浏览器 + Node.js 兼容) ═══

/** 生成指定字节数的十六进制随机 ID */
function generateHexId(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

/** hex → base64 (浏览器兼容实现) */
function hexToBase64(hex: string, expectedBytes: number): string {
  const bytes = new Uint8Array(expectedBytes);
  const padded = hex.padStart(expectedBytes * 2, '0');
  for (let i = 0; i < expectedBytes; i++) {
    bytes[i] = parseInt(padded.substring(i * 2, i * 2 + 2), 16);
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

/** JSON.stringify BigInt replacer — 将 BigInt 转为字符串 */
function bigIntReplacer(_key: string, value: any): any {
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/** HTTP 请求包装 — 带超时 */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ═══ 类型 ═══

export interface TracerOptions {
  plugin: string;
  userId?: string;
  sessionId?: string;
  message: string;
}

interface SpanData {
  trace_id: string;
  span_id: string;
  parent_span_id: string;
  name: string;
  start_time_unix_nano: string;
  end_time_unix_nano?: string;
  status: { code: string; message: string };
  attributes: Record<string, unknown>;
  events: Array<{ name: string; time_unix_nano: string; attributes: Record<string, unknown> }>;
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
  private readonly traceId: string;
  private readonly rootSpanId: string;
  private readonly spans: SpanData[] = [];
  private readonly toolSpans = new Map<string, SpanData>();
  private readonly toolTimings = new Map<string, number>();

  private startTime = 0;
  private responseText = '';
  private tools: Array<{ name: string; ms: number; error: boolean }> = [];
  private hitlTriggered = false;
  private hitlTool = '';

  constructor(private readonly opts: TracerOptions) {
    this.enabled = !!TRACKING_URI;
    this.traceId = 'tr-' + generateHexId(16);
    this.rootSpanId = generateHexId(8);
  }

  /** 执行完整 trace 生命周期 */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.enabled) return fn();

    this.startTime = Date.now();

    const rootSpan: SpanData = {
      trace_id: hexToBase64(this.traceId.slice(3), 16),
      span_id: hexToBase64(this.rootSpanId, 8),
      parent_span_id: '',
      name: `chat:${this.opts.plugin}`,
      start_time_unix_nano: String(BigInt(this.startTime) * 1_000_000n),
      status: { code: 'STATUS_CODE_UNSET', message: '' },
      attributes: {
        'mlflow.traceRequestId': this.traceId,
        'mlflow.spanType': 'CHAIN',
        'mlflow.spanInputs': JSON.stringify({ message: this.opts.message }),
        'mlflow.spanOutputs': JSON.stringify({}),
        'mlflow.experimentId': EXPERIMENT_ID,
        plugin: this.opts.plugin,
        userId: this.opts.userId || 'anonymous',
        sessionId: this.opts.sessionId || '',
        messageLength: this.opts.message.length,
        messagePreview: this.opts.message.slice(0, 200),
      },
      events: [],
    };
    this.spans.push(rootSpan);

    let result: T;
    let hasError = false;
    try {
      result = await fn();
    } catch (e) {
      hasError = true;
      throw e;
    } finally {
      const endTime = Date.now();

      rootSpan.end_time_unix_nano = String(BigInt(endTime) * 1_000_000n);
      rootSpan.status = hasError
        ? { code: 'STATUS_CODE_ERROR', message: 'Agent execution failed' }
        : { code: 'STATUS_CODE_OK', message: '' };

      rootSpan.attributes['mlflow.spanOutputs'] = JSON.stringify({
        reply: this.responseText.slice(0, 200),
        toolCount: this.tools.length,
        tools: this.tools.map(t => t.name),
      });

      await this.upload(endTime);
    }

    return result;
  }

  /** 接收 agent 事件 */
  handleEvent(event: any): void {
    if (!this.enabled) return;

    try {
      switch (event.type) {
        case 'tool_execution_start': {
          this.toolTimings.set(event.toolName, Date.now());

          const toolSpan: SpanData = {
            trace_id: hexToBase64(this.traceId.slice(3), 16),
            span_id: hexToBase64(generateHexId(8), 8),
            parent_span_id: hexToBase64(this.rootSpanId, 8),
            name: `tool:${event.toolName}`,
            start_time_unix_nano: String(BigInt(Date.now()) * 1_000_000n),
            status: { code: 'STATUS_CODE_UNSET', message: '' },
            attributes: {
              'mlflow.traceRequestId': this.traceId,
              'mlflow.spanType': 'TOOL',
              'mlflow.spanInputs': JSON.stringify((event as any).args ?? {}),
              'mlflow.experimentId': EXPERIMENT_ID,
              'tool.name': event.toolName,
            },
            events: [],
          };
          this.toolSpans.set(event.toolName, toolSpan);
          this.spans.push(toolSpan);
          break;
        }

        case 'tool_execution_end': {
          const span = this.toolSpans.get(event.toolName);
          const startMs = this.toolTimings.get(event.toolName) ?? 0;
          const endMs = Date.now();
          const duration = startMs ? endMs - startMs : 0;

          if (span) {
            span.end_time_unix_nano = String(BigInt(endMs) * 1_000_000n);
            span.status = event.isError
              ? { code: 'STATUS_CODE_ERROR', message: event.errorMessage || '' }
              : { code: 'STATUS_CODE_OK', message: '' };
            span.attributes['tool.duration_ms'] = duration;
            span.attributes['mlflow.spanOutputs'] = JSON.stringify((event as any).result ?? {});
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

  /** 构建 trace 元数据 */
  private buildMetadata(): { tags: Record<string, string>; metadata: Record<string, string> } {
    const tags: Record<string, string> = {
      plugin: this.opts.plugin,
      userId: this.opts.userId || 'anonymous',
    };
    if (this.opts.sessionId) tags['sessionId'] = this.opts.sessionId;

    const toolNames = this.tools.map(t => t.name).join(',') || 'none';
    const toolTimings = this.tools.map(t => `${t.name}:${t.ms}ms`).join(';') || 'none';
    const toolErrors = this.tools.filter(t => t.error).map(t => t.name).join(',') || 'none';

    const metadata: Record<string, string> = {
      'response.length': String(this.responseText.length),
      'response.preview': this.responseText.slice(0, 200),
      'tool.count': String(this.tools.length),
      'tool.names': toolNames,
      'tool.timings': toolTimings,
      'tool.errors': toolErrors,
      'hitl.triggered': String(this.hitlTriggered),
      'hitl.tool': this.hitlTool || 'none',
    };

    return { tags, metadata };
  }

  /** 上传 trace 到 MLflow */
  private async upload(endTime: number): Promise<void> {
    try {
      const { tags, metadata } = this.buildMetadata();

      // 第1步: POST /api/3.0/mlflow/traces — 创建 trace 元数据
      const tracePayload = {
        trace: {
          trace_info: {
            trace_id: this.traceId,
            trace_location: {
              type: 'MLFLOW_EXPERIMENT',
              mlflow_experiment: { experiment_id: EXPERIMENT_ID },
            },
            request_time: new Date(this.startTime).toISOString(),
            execution_duration: `${(endTime - this.startTime) / 1000}s`,
            state: 'OK',
            trace_metadata: {
              'mlflow.trace_schema.version': '3',
              ...metadata,
            },
            request_preview: this.opts.message.slice(0, 100),
            response_preview: this.responseText.slice(0, 100),
            client_request_id: this.opts.sessionId || undefined as any,
            tags,
            assessments: [],
          },
        },
      };

      const res1 = await fetchWithTimeout(
        `${TRACKING_URI}/api/3.0/mlflow/traces`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tracePayload),
        },
        TIMEOUT_MS,
      );

      if (!res1.ok) {
        console.warn(`[MLflow] POST traces failed: ${res1.status} ${res1.statusText}`);
        return;
      }

      const created = (await res1.json()) as any;
      const artifactUri: string | undefined =
        created?.trace?.trace_info?.tags?.['mlflow.artifactLocation'];

      if (!artifactUri) {
        console.warn('[MLflow] 响应中未找到 artifactLocation');
        return;
      }

      // 第2步: PUT .../traces.json — 上传 span 数据
      // artifactUri = "mlflow-artifacts:/0/traces/tr-xxx/artifacts"
      const artifactPath = artifactUri.replace('mlflow-artifacts:', '');
      const uploadUrl = `${TRACKING_URI}/api/2.0/mlflow-artifacts/artifacts${artifactPath}/traces.json`;

      const res2 = await fetchWithTimeout(
        uploadUrl,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spans: this.spans }, bigIntReplacer),
        },
        TIMEOUT_MS,
      );

      if (res2.ok) {
        console.log(`[MLflow] trace 已上传: ${TRACKING_URI}/#/traces/${this.traceId}`);
      } else {
        console.warn(`[MLflow] PUT traces.json 失败: ${res2.status} ${res2.statusText}`);
      }
    } catch (e) {
      console.warn(`[MLflow] 上传错误: ${(e as Error).message}`);
    }
  }
}
