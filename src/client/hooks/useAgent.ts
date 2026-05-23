/**
 * useAgent — 聊天状态机 Hook
 *
 * 核心职责：
 * 1. SSE 流式对话管理 — 发送消息，接收 text/tool_result/confirm_required 等事件
 * 2. 确认流程 — 展示 ConfirmCard，处理用户确认/拒绝，防止 SSE 重复推送
 * 3. 阶段追踪 — 驱动 StatusBar 流水线步骤切换
 * 4. 消息管理 — 添加/更新消息，维护对话历史
 *
 * 确认去重机制：
 *   使用 lastConfirmToolRef 记录最近一次处理的 confirm tool 名称。
 *   当 SSE 重复推送同名 confirm_required 时直接忽略，但不同 tool 的确认放行。
 *   这保证了 "表单确认 → 流程确认" 两步确认正常工作。
 */
import { useCallback, useRef, useState } from 'react';
import type { Message, ConfirmRequest, AgentPhase } from '../types';

/** 表单字段的中文标签映射 */
const FIELD_LABELS: Record<string, string> = {
  applicantName: '申请人', department: '部门', employeeId: '工号',
  remoteStartDate: '开始日期', remoteEndDate: '结束日期',
  reason: '申请原因', workPlan: '工作安排',
  emergencyContact: '紧急联系方式', address: '办公地址',
};

export function useAgent() {
  // ── 状态 ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [phaseText, setPhaseText] = useState('请输入远程办公需求');
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Refs ──
  const abortRef = useRef<AbortController | null>(null);          // SSE 流取消控制器
  const lastConfirmToolRef = useRef<string | null>(null);         // 确认去重：记录已处理的 tool 名

  // ── 消息管理 ──

  /** 追加一条消息到列表末尾 */
  const addMessage = useCallback((role: Message['role'], content: string) => {
    const msg: Message = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      role, content, timestamp: Date.now(),
    };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  /** 更新最后一条 assistant 消息的内容（SSE 流式追加文本） */
  const updateLastAssistant = useCallback((content: string) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'assistant') {
        return [...prev, { id: Date.now().toString(36), role: 'assistant', content, timestamp: Date.now() }];
      }
      return [...prev.slice(0, -1), { ...last, content }];
    });
  }, []);

  // ── 核心：发送消息 & SSE 流处理 ──

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    // 重置状态
    setIsStreaming(true);
    setError(null);
    setConfirmRequest(null);
    lastConfirmToolRef.current = null;
    addMessage('user', text);

    // 构建历史记录（最近 20 条非系统消息）
    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    // 预插入空的 assistant 消息位（SSE 流逐步填充）
    addMessage('assistant', '');
    setPhase('thinking');
    setPhaseText('Agent 正在分析...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

      // 逐行解析 SSE 流
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

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
            if (eventType !== 'text') {
              console.log('[SSE] event:', eventType, JSON.stringify(data).slice(0, 100));
            }

            switch (eventType) {
              // ── 流式文本 ──
              case 'text':
                fullText += data.content;
                updateLastAssistant(fullText);
                break;

              // ── 确认请求（弹出 ConfirmCard） ──
              case 'confirm_required':
                // 去重：同 tool 名已在本次会话中处理过则忽略
                if (lastConfirmToolRef.current === data.tool) {
                  console.log('[SSE] confirm_required ignored: duplicate for', data.tool);
                  break;
                }
                console.log('[SSE] confirm_required received:', data);
                setConfirmRequest({
                  tool: data.tool,
                  label: data.label,
                  form: data.form,
                  fieldLabels: data.fieldLabels || FIELD_LABELS,
                });
                setPhase('confirming');
                setPhaseText(
                  data.tool === 'submit_form' ? '请确认表单信息' : '请确认发起审批流程'
                );
                break;

              // ── 确认已处理（关闭弹窗） ──
              case 'confirm_resolved':
                setConfirmRequest(null);
                if (!fullText.includes('发起')) {
                  setPhase('thinking');
                  setPhaseText('Agent 正在处理...');
                }
                break;

              // ── Tool 执行结果（更新阶段指示） ──
              case 'tool_result':
                if (data.tool === 'get_current_date') {
                  setPhase('filling');
                  setPhaseText('正在填写表单...');
                } else if (data.tool === 'validate_form') {
                  setPhase('validating');
                  setPhaseText('校验表单中...');
                }
                break;

              // ── 流程结束 ──
              case 'done':
                setPhase('done');
                setPhaseText('流程结束');
                setConfirmRequest(null);
                lastConfirmToolRef.current = null;
                break;

              // ── 错误 ──
              case 'error':
                updateLastAssistant(fullText + '\n\n⚠️ ' + data.message);
                setPhase('error');
                setPhaseText(data.message);
                setError(data.message);
                break;
            }
          } catch { /* 跳过解析失败的 JSON */ }
        }
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message);
        setPhase('error');
        setPhaseText('连接失败');
        updateLastAssistant('⚠️ 连接失败: ' + err.message);
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [isStreaming, messages, addMessage, updateLastAssistant]);

  // ── 确认处理 ──

  /**
   * 用户点击确认/拒绝按钮
   * 先标记已处理（防止 SSE 重复推送），再通知后端
   */
  const confirm = useCallback(async (approved: boolean) => {
    if (!confirmRequest) return;

    // 先标记去重，再隐藏弹窗（防止竞态）
    lastConfirmToolRef.current = confirmRequest.tool;
    setConfirmRequest(null);

    // 通知后端
    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
    } catch { /* 忽略网络错误 */ }

    // 添加系统消息
    const toolLabel = confirmRequest.tool === 'submit_form' ? '提交表单' : '发起审批流程';
    addMessage('system', approved
      ? `✓ 已确认${toolLabel}`
      : `✕ 已拒绝${toolLabel}`);
  }, [confirmRequest, addMessage]);

  // ── 重置 ──

  /** 重置所有状态，中断当前 SSE 流 */
  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setPhase('idle');
    setPhaseText('请输入远程办公需求');
    setConfirmRequest(null);
    setIsStreaming(false);
    setError(null);
    lastConfirmToolRef.current = null;
  }, []);

  return {
    messages, phase, phaseText, confirmRequest,
    isStreaming, error,
    sendMessage, confirm, reset,
  };
}
