/**
 * 通用 LLM Provider 层
 * 
 * 双协议支持：
 *   - glm-anthropic: 智谱 GLM (Anthropic Messages 格式)
 *   - glm-openai:    智谱 GLM (OpenAI Chat Completions 格式)
 *   - deepseek / qwen / openai: OpenAI 兼容格式
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { z } from 'zod';
import { config } from '../config.js';
import type { LeaveForm } from '../types.js';

// ─── Zod Schema ────────────────────────────────────────────
const LeaveFormSchema = z.object({
  applicantName: z.string(),
  department: z.string(),
  employeeId: z.string(),
  remoteStartDate: z.string(),
  remoteEndDate: z.string(),
  reason: z.string(),
  workPlan: z.string(),
  emergencyContact: z.string(),
  address: z.string(),
});

// 字段描述，用于 prompt
const FIELD_SPECS = `{
  "applicantName": "申请人姓名，如未提及则合理编造如'张三'",
  "department": "所属部门，如未提及则合理编造如'研发部'",
  "employeeId": "工号，如未提及则合理编造如'EMP001'",
  "remoteStartDate": "远程办公开始日期，格式 YYYY-MM-DD",
  "remoteEndDate": "远程办公结束日期，格式 YYYY-MM-DD",
  "reason": "远程办公原因，至少10个字",
  "workPlan": "远程办公期间的工作安排，至少20个字",
  "emergencyContact": "紧急联系方式，手机号或邮箱",
  "address": "远程办公地址"
}`;

// ─── Provider 预设 ─────────────────────────────────────────
interface ProviderPreset {
  protocol: 'anthropic' | 'openai';
  baseURL: string;
  defaultModel: string;
}

const PROVIDERS: Record<string, ProviderPreset> = {
  'glm-anthropic': {
    protocol: 'anthropic',
    baseURL: 'https://api.z.ai/api/anthropic',
    defaultModel: 'glm-5-turbo',
  },
  'glm-openai': {
    protocol: 'openai',
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    defaultModel: 'glm-4-plus',
  },
  deepseek: {
    protocol: 'openai',
    baseURL: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
  },
  qwen: {
    protocol: 'openai',
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    defaultModel: 'qwen-plus',
  },
  openai: {
    protocol: 'openai',
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  },
};

// ─── 提示词 ────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);

const SYSTEM_PROMPT = `你是一个远程办公申请表单填写助手。
根据用户的描述填写申请表单，所有字段都必须填写。

当前日期: ${today}

表单字段定义：
${FIELD_SPECS}

规则：
1. 所有字段都必须填写，不能遗漏任何一个
2. 日期格式 YYYY-MM-DD，开始日期不能早于当前日期(${today})，结束不早于开始，跨度不超30天
3. 原因至少10个字，工作安排至少20个字
4. 紧急联系方式填手机号(1开头11位)或邮箱
5. 如果用户信息不完整，请合理推断或编造补充
6. 如果用户未指定日期，默认从明天开始，申请3-5天

你必须且只能返回一个合法的 JSON 对象，包含所有9个字段。不要输出任何其他内容，不要用 markdown 代码块包裹。`;

const CORRECTION_PROMPT = (errors: string[]): string =>
  `上一次生成的表单有以下校验错误：\n${errors.map(e => `- ${e}`).join('\n')}\n\n请修正以上问题，重新返回包含所有9个字段的完整 JSON。只返回 JSON，不要任何其他内容。`;

// ─── LLM Service ───────────────────────────────────────────
export class LLMService {
  private protocol: 'anthropic' | 'openai';
  private anthropicClient?: Anthropic;
  private openaiClient?: OpenAI;
  private model: string;

  constructor() {
    const preset = PROVIDERS[config.llmProvider];
    if (!preset) {
      throw new Error(
        `未知的 LLM_PROVIDER: "${config.llmProvider}"，可选: ${Object.keys(PROVIDERS).join(', ')}`
      );
    }

    this.protocol = preset.protocol;
    this.model = config.llmModel || preset.defaultModel;
    const baseURL = config.llmBaseURL || preset.baseURL;

    if (this.protocol === 'anthropic') {
      this.anthropicClient = new Anthropic({
        apiKey: config.llmApiKey,
        baseURL,
      });
    } else {
      this.openaiClient = new OpenAI({
        apiKey: config.llmApiKey,
        baseURL,
      });
    }

    console.log(`🤖 LLM: ${config.llmProvider} | ${this.protocol} | model=${this.model} | baseURL=${baseURL}`);
  }

  async fillForm(userInput: string, previousForm?: LeaveForm, errors?: string[]): Promise<LeaveForm> {
    const isCorrection = !!previousForm && !!errors?.length;
    const userContent = isCorrection
      ? CORRECTION_PROMPT(errors!)
      : `请根据以下描述填写远程办公申请表单：\n\n${userInput}`;

    let rawJson: string;

    if (this.protocol === 'anthropic') {
      rawJson = await this.callAnthropic(userContent, isCorrection ? previousForm : undefined);
    } else {
      rawJson = await this.callOpenAI(userContent, isCorrection ? previousForm : undefined);
    }

    // 提取 JSON（兼容 ```json ... ``` 包裹或前后有文字的情况）
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error(`LLM 返回非 JSON 内容: ${rawJson.slice(0, 200)}`);

    const parsed = JSON.parse(jsonMatch[0]);
    return LeaveFormSchema.parse(parsed) as LeaveForm;
  }

  /** Anthropic tool 定义 */
  private static readonly TOOLS: Anthropic.Tool[] = [
    {
      name: 'get_current_date',
      description: '获取当前日期和时间，返回 YYYY-MM-DD HH:mm:ss 格式。在填写日期字段前务必调用此工具获取今天的日期。',
      input_schema: { type: 'object', properties: {} },
    },
  ];

  /** 执行 tool 调用 */
  private static executeTool(name: string): string {
    if (name === 'get_current_date') {
      const now = new Date();
      return now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);
    }
    return `未知工具: ${name}`;
  }

  /**
   * Anthropic 调用（支持 tool use 循环）
   * LLM 可能先调用 get_current_date 再返回 JSON，需要多轮处理
   */
  private async callAnthropic(userContent: string, previousForm?: LeaveForm): Promise<string> {
    const messages: Anthropic.MessageParam[] = [];

    if (previousForm) {
      messages.push({
        role: 'assistant',
        content: JSON.stringify(previousForm),
      });
    }

    messages.push({ role: 'user', content: userContent });

    // 最多允许 3 轮 tool use
    for (let round = 0; round < 3; round++) {
      const response = await this.anthropicClient!.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages,
        tools: LLMService.TOOLS,
        temperature: 0.1,
      });

      // 检查是否有 tool_use
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      const textBlocks = response.content.filter(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );

      if (toolUseBlocks.length === 0) {
        // 没有工具调用，直接返回文本
        const text = textBlocks.map(b => b.text).join('');
        if (!text) throw new Error('Anthropic 返回内容为空');
        return text;
      }

      // 有 tool_use → 执行工具，把结果追加到 messages 继续对话
      console.log(`  🔧 LLM 调用工具: ${toolUseBlocks.map(b => b.name).join(', ')}`);

      // 先把 assistant 的完整回复加入 messages
      messages.push({ role: 'assistant', content: response.content });

      // 执行每个 tool，构造 tool_result
      const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map(block => ({
        type: 'tool_result',
        tool_use_id: block.id,
        content: LLMService.executeTool(block.name),
      }));

      messages.push({ role: 'user', content: toolResults });
    }

    throw new Error('Anthropic tool use 超过最大轮数');
  }

  /** OpenAI tool 定义 */
  private static readonly OPENAI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'get_current_date',
        description: '获取当前日期和时间，返回 YYYY-MM-DD HH:mm:ss 格式。在填写日期字段前务必调用此工具获取今天的日期。',
        parameters: { type: 'object', properties: {} },
      },
    },
  ];

  /** OpenAI 调用（支持 tool use 循环） */
  private async callOpenAI(userContent: string, previousForm?: LeaveForm): Promise<string> {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
    ];

    if (previousForm) {
      messages.push({ role: 'assistant', content: JSON.stringify(previousForm) });
    }

    messages.push({ role: 'user', content: userContent });

    for (let round = 0; round < 3; round++) {
      const response = await this.openaiClient!.chat.completions.create({
        model: this.model,
        messages,
        tools: LLMService.OPENAI_TOOLS,
        temperature: 0.1,
      });

      const choice = response.choices[0];
      const toolCalls = choice?.message?.tool_calls;

      if (!toolCalls || toolCalls.length === 0) {
        const content = choice?.message?.content;
        if (!content) throw new Error('OpenAI 返回内容为空');
        return content;
      }

      console.log(`  🔧 LLM 调用工具: ${toolCalls.map(tc => tc.function.name).join(', ')}`);

      // 加入 assistant 回复
      messages.push(choice.message);

      // 执行 tool 并追加结果
      for (const tc of toolCalls) {
        const result = LLMService.executeTool(tc.function.name);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: result,
        } as OpenAI.Chat.ChatCompletionToolMessageParam);
      }
    }

    throw new Error('OpenAI tool use 超过最大轮数');
  }
}
