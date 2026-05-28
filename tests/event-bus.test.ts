/**
 * AgentEventBus 单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { AgentEventBus } from '../src/agent/events/event-bus.js';

describe('AgentEventBus', () => {
  it('emit → on 触发 handler', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('text', handler);
    bus.emit('text', { content: 'hello' });
    expect(handler).toHaveBeenCalledWith({ content: 'hello' });
  });

  it('多个订阅者独立接收事件', () => {
    const bus = new AgentEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on('done', h1);
    bus.on('done', h2);
    bus.emit('done', {});
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
  });

  it('on() 返回取消订阅函数', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    const unsub = bus.on('text', handler);
    unsub();
    bus.emit('text', { content: 'should not fire' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('destroy() 移除所有监听器', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('text', handler);
    bus.on('done', handler);
    bus.destroy();
    bus.emit('text', { content: 'x' });
    bus.emit('done', {});
    expect(handler).not.toHaveBeenCalled();
  });

  it('不同事件类型不互相干扰', () => {
    const bus = new AgentEventBus();
    const textHandler = vi.fn();
    const doneHandler = vi.fn();
    bus.on('text', textHandler);
    bus.on('done', doneHandler);
    bus.emit('text', { content: 'hello' });
    expect(textHandler).toHaveBeenCalledTimes(1);
    expect(doneHandler).not.toHaveBeenCalled();
  });

  it('confirm_required 事件携带 form 和 fieldLabels', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('confirm_required', handler);
    bus.emit('confirm_required', {
      tool: 'submit',
      label: '确认提交',
      form: { name: '张三', days: '3' },
      fieldLabels: { name: '姓名', days: '天数' },
    });
    expect(handler).toHaveBeenCalledWith({
      tool: 'submit',
      label: '确认提交',
      form: { name: '张三', days: '3' },
      fieldLabels: { name: '姓名', days: '天数' },
    });
  });

  it('done 事件 payload 为空对象', () => {
    const bus = new AgentEventBus();
    const handler = vi.fn();
    bus.on('done', handler);
    bus.emit('done', {});
    expect(handler).toHaveBeenCalledWith({});
  });
});
