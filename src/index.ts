/**
 * CLI 入口 - 命令行交互主程序
 */
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { WorkflowEngine, type ProcessForm } from './workflow/index.js';
import { config } from './config.js';
import type { LeaveForm } from './types.js';

function banner(): void {
  console.log('');
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║      远程办公申请自动化审批 Agent v1.0.0         ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  输入您的远程办公需求，Agent 将自动完成：        ║');
  console.log('║    1. 解析并填写申请表单                         ║');
  console.log('║    2. 校验表单合法性（自动修正）                 ║');
  console.log('║    3. 确认表单 → 提交获取 ID                     ║');
  console.log('║    4. 确认流程表单 → 发起审批流程                ║');
  console.log('║                                                 ║');
  console.log('║  输入 "exit" 退出                                ║');
  console.log('╚══════════════════════════════════════════════════╝');
  console.log('');
}

async function confirmYesNo(rl: readline.Interface, prompt: string): Promise<boolean> {
  while (true) {
    const answer = (await rl.question(prompt)).trim().toLowerCase();
    if (['yes', 'y', '是'].includes(answer)) return true;
    if (['no', 'n', '否', '取消'].includes(answer)) return false;
    console.log('请输入 yes 或 no');
  }
}

async function main(): Promise<void> {
  if (!config.llmApiKey) {
    console.error('❌ 错误: 请设置环境变量 LLM_API_KEY');
    console.error('   创建 .env 文件并写入:');
    console.error('   LLM_API_KEY=your-api-key');
    process.exit(1);
  }

  banner();
  const rl = readline.createInterface({ input, output });

  try {
    while (true) {
      const userInput = (await rl.question('📝 请描述您的远程办公需求:\n> ')).trim();

      if (!userInput || userInput.toLowerCase() === 'exit') {
        console.log('\n👋 再见！');
        break;
      }

      const engine = new WorkflowEngine(config.maxFormRetries);

      try {
        const result = await engine.run(
          userInput,
          // 第一次确认：申请表单
          async (_form: LeaveForm) => {
            return confirmYesNo(rl, '\n❓ 确认以上申请表单无误？(yes/no): ');
          },
          // 第二次确认：流程表单（含 formId）
          async (_processForm: ProcessForm) => {
            return confirmYesNo(rl, '\n❓ 确认发起以上审批流程？(yes/no): ');
          },
        );

        console.log('\n' + (result.success ? '✅' : '❌') + ' ' + result.message);
      } catch (err: any) {
        console.error(`\n❌ 流程异常: ${err.message ?? err}`);
      }

      console.log('\n' + '─'.repeat(50) + '\n');
    }
  } finally {
    rl.close();
  }
}

main().catch(console.error);
