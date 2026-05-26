/**
 * API 客户端 — 前端与 Express 后端的统一通信层
 *
 * 普通请求 (JSON): 使用 axios
 * SSE 流式请求: 使用 fetch + ReadableStream (axios 不支持流式读取)
 */
import axios from 'axios';

/** 预配置的 axios 实例 */
export const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

/** SSE 流式响应的 reader 句柄 */
export interface SSEStream {
  /** 读取流直到结束 */
  read(callbacks: {
    onEvent: (event: string, data: Record<string, unknown>) => void;
    onError?: (error: Error) => void;
  }): Promise<void>;
  /** 中断流 */
  abort(): void;
}

/** SSE 请求选项 */
export interface SSERequestOptions {
  /** 请求路径 (如 '/api/chat') */
  url: string;
  /** POST body */
  body: Record<string, unknown>;
}

/**
 * 创建 SSE 流式连接
 *
 * SSE 需要逐块读取响应体，axios 不支持此模式，
 * 因此使用原生 fetch + ReadableStream
 */
export function createSSEStream(options: SSERequestOptions): SSEStream {
  const controller = new AbortController();

  return {
    async read({ onEvent, onError }) {
      try {
        const res = await fetch(options.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(options.body),
          signal: controller.signal,
        });

        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let eventType = '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
              continue;
            }
            if (!line.startsWith('data: ')) continue;

            try {
              const data = JSON.parse(line.slice(6));
              onEvent(eventType, data);
            } catch { /* 跳过解析失败 */ }
          }
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          onError?.(err);
        }
      }
    },

    abort() {
      controller.abort();
    },
  };
}
