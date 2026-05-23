/**
 * Express Web 服务 — SSE 流式 Agent
 *
 * 架构: 浏览器 → Express → Pi Agent → DeepSeek API
 * Human-in-the-Loop: Agent Tool 内建确认等待，前端显示确认卡片
 *
 * 路由:
 *   POST /api/chat    — SSE 流式对话
 *   POST /api/confirm — 用户确认/拒绝
 */
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import {
  allTools, SYSTEM_PROMPT, getDefaultModel,
  getPendingConfirm, approveConfirm, rejectConfirm
} from './agent.js';
import type { ChatMessage } from '../shared/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/** SSE 辅助：发送一条命名事件 */
function sendSSE(res: Response, event: string, data: Record<string, unknown>) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

/** 表单字段标签映射 */
const FIELD_LABELS: Record<string, string> = {
  applicantName: '申请人', department: '部门', employeeId: '工号',
  remoteStartDate: '开始日期', remoteEndDate: '结束日期',
  reason: '申请原因', workPlan: '工作安排',
  emergencyContact: '紧急联系方式', address: '办公地址',
};

/**
 * POST /api/chat — SSE 流式对话
 *
 * 流程：
 * 1. 接收用户消息 + 对话历史
 * 2. 创建 Pi Agent，订阅事件
 * 3. 将 tool_execution_start 事件转为 SSE (confirm_required / tool_result)
 * 4. 将 message_update 事件转为 SSE (text 流)
 * 5. 轮询 pendingConfirm 状态，确认完成时发送 confirm_resolved
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history } = req.body as { message?: string; history?: ChatMessage[] };
  if (!message) return res.status(400).json({ error: 'message required' });

  // 设置 SSE 响应头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 转换历史消息格式
  const initialMessages = (history || []).map(m => ({
    role: m.role as 'user' | 'assistant',
    content: typeof m.content === 'string'
      ? [{ type: 'text' as const, text: m.content }]
      : m.content as any,
    timestamp: Date.now(),
  } as any));

  const model = getDefaultModel();
  const agent = new Agent({
    initialState: {
      systemPrompt: SYSTEM_PROMPT,
      tools: allTools,
      model,
      messages: initialMessages,
    },
    streamFn: streamSimple,
  });

  // 轮询确认状态的定时器
  let confirmTick: ReturnType<typeof setInterval> | null = null;

  // 订阅 Agent 事件 → 转为 SSE
  agent.subscribe(async (event, _signal) => {
    // 调试日志
    if (event.type === 'tool_execution_start' || event.type === 'tool_execution_end') {
      const ev = event as any;
      console.log(`[Event] ${event.type}:`, ev.toolName, '| args keys:', ev.args ? Object.keys(ev.args) : 'none');
    } else if (event.type === 'message_update') {
      // text_delta 太频繁，不打印
    } else {
      console.log(`[Event] ${event.type}`);
    }

    switch (event.type) {
      // ── Tool 开始执行 ──
      case 'tool_execution_start':
        console.log(`  → tool: ${event.toolName}, args:`, JSON.stringify((event as any).args).slice(0, 200));

        // submit_form / start_process 需要用户确认 → 发送 confirm_required 事件
        if (event.toolName === 'submit_form' || event.toolName === 'start_process') {
          const tevent = event as any;
          const form = tevent.args?.form || tevent.args;

          // 启动轮询：检测确认是否完成
          confirmTick = setInterval(() => {
            const pc = getPendingConfirm();
            if (!pc) {
              if (confirmTick) { clearInterval(confirmTick); confirmTick = null; }
              sendSSE(res, 'confirm_resolved', { tool: event.toolName });
            }
          }, 200);

          // 推送确认请求到前端
          sendSSE(res, 'confirm_required', {
            tool: event.toolName,
            label: event.toolName === 'submit_form'
              ? '📋 确认提交表单'
              : '🚀 确认发起审批流程',
            form,
            fieldLabels: FIELD_LABELS,
          });
          console.log(`  → sent confirm_required SSE for ${event.toolName}`);
        }
        break;

      // ── Tool 执行结束 ──
      case 'tool_execution_end':
        console.log(`  → tool_end: ${event.toolName}, isError: ${event.isError}`);
        // 确认类 tool 的结果由 confirm_resolved 通知，这里只发送非确认 tool 的结果
        if (event.toolName !== 'submit_form' && event.toolName !== 'start_process') {
          sendSSE(res, 'tool_result', {
            tool: event.toolName,
            error: event.isError,
          });
        }
        break;

      // ── AI 流式文本输出 ──
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') {
          sendSSE(res, 'text', { content: ev.delta });
        }
        break;
      }

      case 'message_end':
        break;

      // ── Agent 执行完毕 ──
      case 'agent_end':
        if (confirmTick) clearInterval(confirmTick);
        sendSSE(res, 'done', {});
        break;
    }
  });

  try {
    await agent.prompt(message);
    await agent.waitForIdle();
  } catch (err: any) {
    if (confirmTick) clearInterval(confirmTick);
    sendSSE(res, 'error', { message: err.message || String(err) });
  } finally {
    res.end();
  }
});

/**
 * POST /api/confirm — 用户确认/拒绝
 *
 * 前端的确认/拒绝按钮调用此接口，通知 Agent 继续或终止
 */
app.post('/api/confirm', (req: Request, res: Response) => {
  const { approved } = req.body;
  if (approved) {
    const ok = approveConfirm();
    res.json({ ok, message: ok ? '已确认' : '无待确认请求' });
  } else {
    const ok = rejectConfirm();
    res.json({ ok, message: ok ? '已拒绝' : '无待确认请求' });
  }
});

// ── 启动服务 ──
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  远程办公申请自动化审批 Agent (Web UI)       ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log(`║  地址: http://localhost:${PORT}                  ║`);
  console.log(`║  模型: ${getDefaultModel().name.padEnd(34)}║`);
  console.log('╚══════════════════════════════════════════════╝');
  console.log('');
});
