/**
 * 业务场景接口 — Agent 框架与业务逻辑的唯一契约
 *
 * 每接入一个新业务类型，只需实现此接口并注册到 registry 即可。
 * 框架层 (agent/) 和前端 (client/) 不感知具体业务。
 */
import type { AgentTool } from '@earendil-works/pi-agent-core';
import type { FieldMeta } from '../models/FieldMeta.js';
import type { ValidationResult } from '../models/ValidationResult.js';
import type { PipelineStep } from '../models/PipelineStep.js';
import type { SubmitResult, StartProcessResult } from '../dto/ApiResponses.js';

/**
 * 业务场景
 *
 * 框架通过此接口获取所有业务相关信息：
 *   - systemPrompt → 注入 Agent
 *   - fields → 驱动 UI 表单渲染
 *   - tools → 注册到 Agent
 *   - validate → 表单校验
 *   - pipeline → 驱动 StatusBar 阶段指示器
 */
export interface Scenario {
  /** 唯一标识，用于 URL 参数 / registry 查找 */
  id: string;

  /** 前端显示的标题 */
  displayName: string;

  /** 表单字段定义 */
  fields?: FieldMeta[];

  /** Agent System Prompt（支持 ${config.maxFormRetries} 等变量） */
  systemPrompt: string;

  /** Agent Tools 列表 */
  tools: AgentTool<any>[];

  /** 表单校验函数 */
  validate?(form: Record<string, string>): ValidationResult;

  /** 提交表单的 API（由场景提供，框架通过 Tool 工厂调用） */
  submitApi?: (form: Record<string, string>) => Promise<SubmitResult>;

  /** 发起流程的 API */
  startProcessApi?: (resultId: string, form: Record<string, string>) => Promise<StartProcessResult>;

  /** 确认阶段的文案 */
  confirmLabels?: Record<string, string>;

  /** HITL: 需要用户确认的 tool 名称列表。空数组 = 全自动无确认。 */
  confirmTools?: string[];

  /** 流水线阶段定义（可选，使用默认则从 fields 推导） */
  pipeline?: PipelineStep[];

  /** 展示前格式化表单数据（可选） */
  formatFormForDisplay?(form: Record<string, string>): Record<string, string>;

  /** 空状态快捷建议语（可选，3-4 条） */
  suggestions?: string[];
}
