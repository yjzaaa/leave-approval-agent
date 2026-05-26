/**
 * MLflow Tracing 集成 — 纯 REST API 实现
 *
 * 基于 axios 调用 MLflow REST API，零 OpenTelemetry 依赖。
 * 适用于 Vite esbuild 环境，不受 Node.js native 绑定限制。
 *
 * 设计模式:
 *   ITracer (接口)
 *     ├── RestTracer   — 有 MLFLOW_TRACKING_URI 时，通过 REST API 上报
 *     └── NoopTracer   — 无 MLFLOW_TRACKING_URI 时，空操作零开销
 *
 * 工厂: createTracer(opts) → ITracer
 */
import axios from 'axios';

/** 追踪 URI（从环境变量读取） */
const TRACKING_URI: string =
  typeof process !== 'undefined' && process.env?.MLFLOW_TRACKING_URI
    ? process.env.MLFLOW_TRACKING_URI
    : '';

const EXPERIMENT_ID: string =
  typeof process !== 'undefined' && process.env?.MLFLOW_EXPERIMENT_ID
    ? process.env.MLFLOW_EXPERIMENT_ID
    : '0';

/** MLflow API 超时 */
const TIMEOUT_MS = 2000;

/** MLflow API 客户端 */
const mlflowApi = axios.create({
  baseURL: TRACKING_URI,
  timeout: TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

// ═══ 工具函数 ═══

/** 生成指定字节数的十六进制随机 ID */
function generateHexId(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
}

// ═══ 类型 ═══

export interface TracerOptions {
  scenario: string;
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
 * ITracer — Tracer 接口
 *
 * 所有 tracer 实现必须满足此接口。
 * 调用方不关心具体实现（RestTracer / NoopTracer），只依赖接口。
 */
export interface ITracer {
  /** 执行完整 trace 生命周期，返回 fn 的结果 */
  run<T>(fn: () => Promise<T>): Promise<T>;
  /** 接收 agent 事件 */
  handleEvent(event: { type: string; toolName?: string; isError?: boolean; errorMessage?: string; args?: unknown; result?: unknown; assistantMessageEvent?: { type: string; delta?: string } }): void;
  /** 标记 HITL 触发 */
  markHitl(toolName: string): void;
}

// ═══ NoopTracer — 无 MLFLOW_TRACKING_URI 时的空操作 ═══

class NoopTracer implements ITracer {
  async run<T>(fn: () => Promise<T>): Promise<T> { return fn(); }
  handleEvent(_event: { type: string; toolName?: string; isError?: boolean; errorMessage?: string; args?: unknown; result?: unknown; assistantMessageEvent?: { type: string; delta?: string } }): void { /* no-op */ }
  markHitl(_toolName: string): void { /* no-op */ }
}

// ═══ RestTracer — 基于 axios REST API 上报 ═══

class RestTracer implements ITracer {
  private readonly traceId = 'tr-' + generateHexId(16);
  private readonly rootSpanId = generateHexId(8);
  private readonly spans: SpanData[] = [];
  private readonly toolSpans = new Map<string, SpanData>();
  private readonly toolTimings = new Map<string, number>();

  private startTime = 0;
  private responseText = '';
  private tools: Array<{ name: string; ms: number; error: boolean }> = [];
  private hitlTriggered = false;
  private hitlTool = '';

  constructor(private readonly opts: TracerOptions) {}

  /** 执行完整 trace 生命周期 */
  async run<T>(fn: () => Promise<T>): Promise<T> {
    this.startTime = Date.now();

    const rootSpan: SpanData = {
      trace_id: this.traceId,
      span_id: this.rootSpanId,
      parent_span_id: '',
      name: `chat:${this.opts.scenario}`,
      start_time_unix_nano: String(BigInt(this.startTime) * 1_000_000n),
      status: { code: 'STATUS_CODE_UNSET', message: '' },
      attributes: {
        'mlflow.traceRequestId': this.traceId,
        'mlflow.spanType': 'CHAIN',
        'mlflow.spanInputs': JSON.stringify({ message: this.opts.message }),
        'mlflow.spanOutputs': JSON.stringify({}),
        'mlflow.experimentId': EXPERIMENT_ID,
        scenario: this.opts.scenario,
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

      // fire-and-forget: 不阻塞主流程，MLflow 不可达时不影响响应
      this.upload(endTime).catch(() => { /* 静默 */ });
    }

    return result;
  }

  /** 接收 agent 事件 */
  handleEvent(event: { type: string; toolName?: string; isError?: boolean; errorMessage?: string; args?: unknown; result?: unknown; assistantMessageEvent?: { type: string; delta?: string } }): void {
    try {
      switch (event.type) {
        case 'tool_execution_start': {
          const toolName = event.toolName ?? '';
          this.toolTimings.set(toolName, Date.now());

          const toolSpan: SpanData = {
            trace_id: this.traceId,
            span_id: generateHexId(8),
            parent_span_id: this.rootSpanId,
            name: `tool:${toolName}`,
            start_time_unix_nano: String(BigInt(Date.now()) * 1_000_000n),
            status: { code: 'STATUS_CODE_UNSET', message: '' },
            attributes: {
              'mlflow.traceRequestId': this.traceId,
              'mlflow.spanType': 'TOOL',
              'mlflow.spanInputs': JSON.stringify(event.args ?? {}),
              'mlflow.experimentId': EXPERIMENT_ID,
              'tool.name': toolName,
            },
            events: [],
          };
          this.toolSpans.set(toolName, toolSpan);
          this.spans.push(toolSpan);
          break;
        }

        case 'tool_execution_end': {
          const toolName = event.toolName ?? '';
          const span = this.toolSpans.get(toolName);
          const startMs = this.toolTimings.get(toolName) ?? 0;
          const endMs = Date.now();
          const duration = startMs ? endMs - startMs : 0;

          if (span) {
            span.end_time_unix_nano = String(BigInt(endMs) * 1_000_000n);
            span.status = event.isError
              ? { code: 'STATUS_CODE_ERROR', message: event.errorMessage ?? '' }
              : { code: 'STATUS_CODE_OK', message: '' };
            span.attributes['tool.duration_ms'] = duration;
            span.attributes['mlflow.spanOutputs'] = JSON.stringify(event.result ?? {});
            this.toolSpans.delete(toolName);
          }

          this.tools.push({ name: toolName, ms: duration, error: !!event.isError });
          this.toolTimings.delete(toolName);
          break;
        }

        case 'message_update': {
          if (event.assistantMessageEvent?.type === 'text_delta') {
            this.responseText += event.assistantMessageEvent.delta ?? '';
          }
          break;
        }
      }
    } catch (e) {
      console.warn('[MLflow] handleEvent error:', e instanceof Error ? e.message : String(e));
    }
  }

  /** 标记 HITL 触发 */
  markHitl(toolName: string): void {
    this.hitlTriggered = true;
    this.hitlTool = toolName;
  }

  /** 上传 trace 到 MLflow */
  private async upload(endTime: number): Promise<void> {
    try {
      const toolNames = this.tools.map(t => t.name).join(',') || 'none';
      const toolTimings = this.tools.map(t => `${t.name}:${t.ms}ms`).join(';') || 'none';

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
              'tool.count': String(this.tools.length),
              'tool.names': toolNames,
              'tool.timings': toolTimings,
              'hitl.triggered': String(this.hitlTriggered),
              'hitl.tool': this.hitlTool || 'none',
            },
            request_preview: this.opts.message.slice(0, 100),
            response_preview: this.responseText.slice(0, 100),
            client_request_id: this.opts.sessionId || undefined,
            tags: {
              scenario: this.opts.scenario,
              userId: this.opts.userId || 'anonymous',
            },
            assessments: [],
          },
        },
      };

      const res1 = await mlflowApi.post('/api/3.0/mlflow/traces', tracePayload);

      const artifactUri: string | undefined =
        res1.data?.trace?.trace_info?.tags?.['mlflow.artifactLocation'];

      if (!artifactUri) {
        console.warn('[MLflow] 响应中未找到 artifactLocation');
        return;
      }

      // 第2步: PUT .../traces.json — 上传 span 数据
      const artifactPath = artifactUri.replace('mlflow-artifacts:', '');
      const uploadUrl = `${TRACKING_URI}/api/2.0/mlflow-artifacts/artifacts${artifactPath}/traces.json`;

      await mlflowApi.put(uploadUrl, { spans: this.spans });
      console.log(`[MLflow] trace 已上传: ${TRACKING_URI}/#/traces/${this.traceId}`);
    } catch (e) {
      if (axios.isAxiosError(e)) {
        console.warn(`[MLflow] API 错误: ${e.response?.status} ${e.message}`);
      } else {
        console.warn(`[MLflow] 上传错误: ${(e as Error).message}`);
      }
    }
  }
}

// ═══ 连接状态缓存 ═══

/** MLflow 连接状态: null=未检测, true=可达, false=不可达 */
let connectivityCache: boolean | null = null;
/** 上次检测时间 */
let lastCheckTime = 0;
/** 连接检测间隔 (5 分钟) */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** 检测 MLflow 服务是否可达 */
async function checkConnectivity(): Promise<boolean> {
  if (!TRACKING_URI) return false;

  const now = Date.now();
  // 缓存有效期内直接返回
  if (connectivityCache !== null && now - lastCheckTime < CHECK_INTERVAL_MS) {
    return connectivityCache;
  }

  try {
    await axios.get(`${TRACKING_URI}/health`, { timeout: 2000 });
    connectivityCache = true;
  } catch {
    connectivityCache = false;
  }
  lastCheckTime = now;

  if (!connectivityCache) {
    console.warn('[MLflow] 服务不可达，降级为 NoopTracer');
  }

  return connectivityCache;
}

// ═══ 工厂函数 ═══

/**
 * 创建 Tracer — 根据环境自动选择实现
 *
 * - 有 MLFLOW_TRACKING_URI 且服务可达 → RestTracer (axios REST API)
 * - 无 MLFLOW_TRACKING_URI 或服务不可达 → NoopTracer (空操作零开销)
 *
 * 连接状态缓存 5 分钟，避免每次请求都检测
 */
export async function createTracer(opts: TracerOptions): Promise<ITracer> {
  if (!TRACKING_URI) return new NoopTracer();
  const reachable = await checkConnectivity();
  return reachable ? new RestTracer(opts) : new NoopTracer();
}
