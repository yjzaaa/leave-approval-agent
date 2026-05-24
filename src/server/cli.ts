/**
 * CLI 入口 — 插件化 Agent 命令行交互
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import { getPlugin } from '../plugins/registry.js';
import { getDefaultModel } from '../agent/core/agent-factory.js';

function banner(displayName: string): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log(`║     插件化 Agent v3.2 — ${displayName.padEnd(21)}║`);
  console.log('╠══════════════════════════════════════════════════════╣');
  console.log('║  基于 Pi Agent Framework                            ║');
  console.log('║  输入 "exit" 退出 | "reset" 重置对话                 ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');
}

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
  const pluginArg = process.argv.find(a => a.startsWith('--plugin='));
  const pluginId = pluginArg?.split('=')[1] || 'leave_approval';
  const plugin = getPlugin(pluginId);
  banner(plugin.displayName);

  const rl = readline.createInterface({ input, output });

  let model;
  try {
    model = getDefaultModel();
    console.log(`🤖 模型: ${model.name} | Provider: ${model.provider}`);
  } catch (err: any) {
    console.error(`❌ 模型加载失败: ${err.message}`);
    process.exit(1);
  }

  const agent = new Agent({
    initialState: {
      systemPrompt: plugin.systemPrompt,
      tools: plugin.tools,
      model,
    },
    streamFn: streamSimple,
  });

  let lastAssistantText = '';
  agent.subscribe(async (event) => {
    switch (event.type) {
      case 'agent_start': lastAssistantText = ''; break;
      case 'tool_execution_start': console.log(`  🔧 ${event.toolName}`); break;
      case 'tool_execution_end':
        if (event.isError) console.log(`  ❌ ${event.toolName} 失败`);
        break;
      case 'message_start': lastAssistantText = ''; break;
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') { process.stdout.write(ev.delta); lastAssistantText += ev.delta; }
        break;
      }
      case 'message_end': console.log(''); break;
      case 'agent_end':
        if (!lastAssistantText && event.messages) {
          const text = extractText(event.messages);
          if (text) console.log(text);
        }
        break;
    }
  });

  try {
    while (true) {
      const userInput = (await rl.question('📝 请输入:\n> ')).trim();
      if (!userInput) continue;
      if (userInput.toLowerCase() === 'exit') { console.log('\n👋 再见！'); break; }
      if (userInput.toLowerCase() === 'reset') { agent.reset(); console.log('🔄 已重置\n'); continue; }
      try {
        console.log('\n🤖');
        await agent.prompt(userInput);
        await agent.waitForIdle();
      } catch (err: any) {
        console.error(`\n❌ 错误: ${err.message ?? err}`);
      }
      console.log('\n' + '─'.repeat(50) + '\n');
    }
  } finally { rl.close(); }
}

main().catch(console.error);