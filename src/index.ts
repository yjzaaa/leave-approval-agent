/**
 * CLI 入口 — 基于 Pi Agent Framework
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Agent } from '@earendil-works/pi-agent-core';
import { streamSimple } from '@earendil-works/pi-ai';
import { allTools, SYSTEM_PROMPT, getDefaultModel } from './agent.js';

function banner(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║   远程办公申请自动化审批 Agent v2.0.0 (Pi)       ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║   基于 Pi Agent Framework (53k ⭐)               ║');
  console.log('║   Agent 自主决策调用工具完成审批流程              ║');
  console.log('║  输入 "exit" 退出 | "reset" 重置对话             ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}

async function main(): Promise<void> {
  banner();
  const rl = readline.createInterface({ input, output });

  let model;
  try {
    model = getDefaultModel();
    console.log(`🤖 模型: ${model.name} | Provider: ${model.provider} | API: ${model.api}`);
  } catch (err: any) {
    console.error(`❌ 模型加载失败: ${err.message}`);
    console.error('   请确保 .env 中配置了 OPENAI_API_KEY');
    process.exit(1);
  }

  const agent = new Agent({
    initialState: { systemPrompt: SYSTEM_PROMPT, tools: allTools, model },
    streamFn: streamSimple,
  });

  // 订阅事件输出
  agent.subscribe(async (event, _signal) => {
    switch (event.type) {
      case 'tool_execution_start':
        console.log(`  🔧 ${event.toolName}`);
        break;
      case 'tool_execution_end':
        if (event.isError) console.log(`  ❌ ${event.toolName} 失败`);
        break;
      case 'message_update': {
        const ev = event.assistantMessageEvent;
        if (ev.type === 'text_delta') {
          process.stdout.write(ev.delta);
        }
        break;
      }
      case 'message_end':
        console.log('');
        break;
    }
  });

  try {
    while (true) {
      const userInput = (await rl.question('📝 请描述您的远程办公需求:\n> ')).trim();

      if (!userInput) continue;
      if (userInput.toLowerCase() === 'exit') { console.log('\n👋 再见！'); break; }
      if (userInput.toLowerCase() === 'reset') { agent.reset(); console.log('🔄 对话已重置\n'); continue; }

      try {
        console.log('\n🤖');
        await agent.prompt(userInput);
        await agent.waitForIdle();
      } catch (err: any) {
        console.error(`\n❌ 错误: ${err.message ?? err}`);
      }

      console.log('\n' + '─'.repeat(50) + '\n');
    }
  } finally {
    rl.close();
  }
}

main().catch(console.error);
