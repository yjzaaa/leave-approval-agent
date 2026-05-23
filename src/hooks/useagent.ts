import { useCallback, useRef, useState } from 'react';
import type { Message, ConfirmRequest, AgentPhase } from '../client-types';

const FIELD_LABELS: Record<string, string> = {
  applicantName: '申请人', department: '部门', employeeId: '工号',
  remoteStartDate: '开始日期', remoteEndDate: '结束日期',
  reason: '申请原因', workPlan: '工作安排',
  emergencyContact: '紧急联系方式', address: '办公地址',
};

export function useAgent() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<AgentPhase>('idle');
  const [phaseText, setPhaseText] = useState('请输入远程办公需求');
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addMessage = useCallback((role: Message['role'], content: string) => {
    const msg: Message = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), role, content, timestamp: Date.now() };
    setMessages(prev => [...prev, msg]);
    return msg;
  }, []);

  const updateLastAssistant = useCallback((content: string) => {
    setMessages(prev => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role !== 'assistant') return [...prev, { id: Date.now().toString(36), role: 'assistant', content, timestamp: Date.now() }];
      return [...prev.slice(0, -1), { ...last, content }];
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setIsStreaming(true);
    setError(null);
    setConfirmRequest(null);
    addMessage('user', text);

    const history = messages
      .filter(m => m.role !== 'system')
      .slice(-20)
      .map(m => ({ role: m.role, content: m.content }));

    addMessage('assistant', '');
    setPhase('thinking');
    setPhaseText('Agent 正在分析…');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
        signal: controller.signal,
      });

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
          if (line.startsWith('event: ')) { eventType = line.slice(7).trim(); continue; }
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (eventType !== 'text') console.log('[SSE] event:', eventType, JSON.stringify(data).slice(0, 100));
            switch (eventType) {
              case 'text':
                fullText += data.content;
                updateLastAssistant(fullText);
                break;
              case 'confirm_required':
                console.log('[SSE] confirm_required received:', data);
                setConfirmRequest({
                  tool: data.tool,
                  label: data.label,
                  form: data.form,
                  fieldLabels: data.fieldLabels || FIELD_LABELS,
                });
                setPhase('confirming');
                setPhaseText(data.tool === 'submit_form' ? '请确认表单信息' : '请确认发起审批流程');
                console.log('[SSE] confirmRequest set, phase: confirming');
                break;
              case 'confirm_resolved':
                setConfirmRequest(null);
                if (!fullText.includes('发起')) {
                  setPhase('thinking');
                  setPhaseText('Agent 正在处理…');
                }
                break;
              case 'tool_result':
                if (data.tool === 'get_current_date') { setPhase('filling'); setPhaseText('正在填写表单…'); }
                else if (data.tool === 'validate_form') { setPhase('validating'); setPhaseText('校验表单中…'); }
                break;
              case 'done':
                setPhase('done');
                setPhaseText('流程结束');
                setConfirmRequest(null);
                break;
              case 'error':
                updateLastAssistant(fullText + '\n\n⚠️ ' + data.message);
                setPhase('error');
                setPhaseText(data.message);
                setError(data.message);
                break;
            }
          } catch { /* skip bad JSON */ }
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

  const confirm = useCallback(async (approved: boolean) => {
    if (!confirmRequest) return;
    try {
      await fetch('/api/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved }),
      });
    } catch { /* ignore */ }

    const toolLabel = confirmRequest.tool === 'submit_form' ? '提交表单' : '发起审批流程';
    addMessage('system', approved
      ? `✅ 已确认${toolLabel}`
      : `❌ 已拒绝${toolLabel}`);
    setConfirmRequest(null);
  }, [confirmRequest, addMessage]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setPhase('idle');
    setPhaseText('请输入远程办公需求');
    setConfirmRequest(null);
    setIsStreaming(false);
    setError(null);
  }, []);

  return { messages, phase, phaseText, confirmRequest, isStreaming, error, sendMessage, confirm, reset };
}
