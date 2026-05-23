/**
 * CLI 入口 — 插件化 Agent 命令行交互
 *
 * 支持通过 --plugin <id> 切换业务插件，默认 leave_approval。
 * 输入 "exit" 退出 | "reset" 重置对话 | 直接输入需求开始对话
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import { getDefaultPlugin, getPlugin } from '../plugins/registry.js';
import { getDefaultModel } from '../agent/agent-factory.js';
import { getCurrentDateTool } from '../agent/tools/get-current-date.js';
import { createValidateTool } from '../agent/tools/validate-form.js';
import { createSubmitTool } from '../agent/tools/submit-form.js';
import { createStartProcessTool } from '../agent/tools/start-process.js';
import type { BusinessPlugin } from '../shared/plugin.js';
import { requestConfirm, approveConfirm, rejectConfirm } from '../agent/confirm-state.js';

/** 根据插件构建 Tool 列表 */
function buildTools(plugin: BusinessPlugin) {
  return [
    getCurrentDateTool,
    createValidateTool(plugin),
    createSubmitTool(plugin),
    createStartProcessTool(plugin),
  ];
}

/** 打印启动横幅 */
function banner(plugin: BusinessPlugin): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log(`║     插件化审批 Agent v3.0 — ${plugin.displayName.padEnd(21)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  基于 Pi Agent Framework                            ║');
  console.log('║  Agent 自主决策调用工具完成审批流程                  ║');
  console.log('║  输入 "exit" 退出 | "reset" 重置对话                 ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
}

/** 从 AgentMessage 提取文本内容 */
function extractText(messages: any[]): string {
  const parts: string[] = [];
  for (const msg of messages) {
    if (msg.role === 'assistant' && msg.content) {
      for (const block of msg.content) {
        if (block.type === 'text') parts.push(block.text);
      }
    }
  }
  return parts.join('\n');
}

async function main(): Promise<void> {
  // 解析命令行参数
  const pluginArg = process.argv.find(a => a.startsWith('--plugin='));
  const pluginId = pluginArg?.split('=')[1] || 'leave_approval';
  const plugin = getPlugin(pluginId);

  banner(plugin);

  const rl = readline.createInterface({ input, output });

  // ── 加载模型 ──
  let model;
  try {
    model = getDefaultModel();
    console.log(`🤖 模型: ${model.name} | Provider: ${model.provider}`);
  } catch (err: any) {
    console.error(`❌ 模型加载失败: ${err.message}`);
    console.error('   请确认 .env 中配置了 DEEPSEEK_API_KEY');
    process.exit(1);
  }

  // ── 创建 Agent（注入插件） ──
  const agent = new Agent({
    initialState: {
      systemPrompt: plugin.systemPrompt,
      tools: buildTools(plugin),
      model,
    },
    streamFn: streamSimple,
  });

  // ── 事件订阅 ──
  let lastAssistantText = '';

  agent.subscribe(async (event, _signal) => {
    switch (event.type) {
      case 'agent_start':
        lastAssistantText = '';
        break;
      case 'tool_execution_start':
        console.log(`  🔧 ${event.toolName}`);
        break;
      case 'tool_execution_end':
        if (event.isError) console.log(`  ❌ ${event.toolName} 失败`);
        break;
      case 'message_start':
        lastAssistantText = '';
        break;
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') {
          process.stdout.write(ev.delta);
          lastAssistantText += ev.delta;
        }
        break;
      }
      case 'message_end':
        console.log('');
        break;
      case 'agent_end':
        if (!lastAssistantText && event.messages) {
          const text = extractText(event.messages);
          if (text) console.log(text);
        }
        break;
    }
  });

  // ── 主循环 ──
  try {
    while (true) {
      const userInput = (await rl.question('📝 请描述您的需求:\n> ')).trim();

      if (!userInput) continue;
      if (userInput.toLowerCase() === 'exit') {
        console.log('\n👋 再见！');
        break;
      }
      if (userInput.toLowerCase() === 'reset') {
        agent.reset();
        console.log('🔄 对话已重置\n');
        continue;
      }

      try {
        console.log('\n🤖');
        await agent.prompt(userInput);
        await agent.waitForIdle();
      } catch (err: any) {
        console.error(`\n❌ 错误: ${err.message ?? err}`);
        if (err.cause) console.error(`   原因: ${err.cause}`);
      }

      console.log('\n' + '─'.repeat(50) + '\n');
    }
  } finally {
    rl.close();
  }
}

main().catch(console.error);
