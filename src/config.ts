/**
 * 配置管理 - 从 .env 文件读取
 */
import 'dotenv/config';

export const config = {
  /** LLM Provider: glm-anthropic | glm-openai | deepseek | qwen | openai */
  llmProvider: (process.env.LLM_PROVIDER ?? 'glm-openai').toLowerCase(),

  /** LLM API Key */
  llmApiKey: process.env.LLM_API_KEY ?? '',

  /** 自定义 BaseURL（覆盖预设）*/
  llmBaseURL: process.env.LLM_BASE_URL ?? '',

  /** 使用的模型（覆盖预设默认值）*/
  llmModel: process.env.LLM_MODEL ?? '',

  /** 表单自动修正最大重试次数 */
  maxFormRetries: parseInt(process.env.MAX_FORM_RETRIES ?? '5', 10),

  /** 真实 API 基地址 (留空则使用 mock) */
  apiBaseUrl: process.env.API_BASE_URL ?? '',
};
