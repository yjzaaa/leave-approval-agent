/**
 * Web 服务器 — Express + SSE 流式 Agent
 *
 * 架构: 浏览器 → Express → Pi Agent → DeepSeek API
 * Human-in-the-Loop: Agent Tool 内建确认等待，前端显示确认卡片
 */
import express from 'express';
import type { Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import { allTools, SYSTEM_PROMPT, getDefaultModel, getPendingConfirm, approveConfirm, rejectConfirm } from './agent.js';
import type { ChatMessage } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

/** SSE 辅助 */
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
 */
app.post('/api/chat', async (req: Request, res: Response) => {
  const { message, history } = req.body as { message?: string; history?: ChatMessage[] };
  if (!message) return res.status(400).json({ error: 'message required' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // 初始历史消息
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

  // 轮询确认状态
  let confirmTick: ReturnType<typeof setInterval> | null = null;

  agent.subscribe(async (event, _signal) => {
    switch (event.type) {
      case 'tool_execution_start':
        if (event.toolName === 'submit_form' || event.toolName === 'start_process') {
          const form = event.args?.form || event.args;
          confirmTick = setInterval(() => {
            const pc = getPendingConfirm();
            if (!pc) {
              // 确认已完成
              if (confirmTick) { clearInterval(confirmTick); confirmTick = null; }
              sendSSE(res, 'confirm_resolved', { tool: event.toolName });
            }
          }, 200);
          sendSSE(res, 'confirm_required', {
            tool: event.toolName,
            label: event.toolName === 'submit_form'
              ? '📋 确认提交表单'
              : '🚀 确认发起审批流程',
            form,
            fieldLabels: FIELD_LABELS,
          });
        }
        break;

      case 'tool_execution_end':
        // 只通知非确认类工具的结果
        if (event.toolName !== 'submit_form' && event.toolName !== 'start_process') {
          sendSSE(res, 'tool_result', {
            tool: event.toolName,
            error: event.isError,
            result: (event as any).result,
          });
        }
        break;

      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') {
          sendSSE(res, 'text', { content: ev.delta });
        }
        break;
      }

      case 'message_end':
        break;

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
