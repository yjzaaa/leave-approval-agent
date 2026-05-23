/**
 * 业务插件接口 — Agent 框架与业务逻辑的唯一契约
 *
 * 每接入一个新业务类型，只需实现此接口并注册到 registry 即可。
 * 框架层 (agent/) 和前端 (client/) 不感知具体业务。
 */
import type { AgentTool } from '@earendil-works/pi-agent-core';

// ═══════════════════════════════════════════════════════
// 基础类型
// ═══════════════════════════════════════════════════════

/** 表单字段元信息 */
export interface FieldMeta {
  key: string;
  label: string;
  type: 'text' | 'date' | 'select' | 'textarea';
  required?: boolean;
  placeholder?: string;
}

/** 校验结果 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** 流水线步骤定义（驱动前端 StatusBar） */
export interface PipelineStep {
  key: string;
  label: string;
  /** 关联的 tool 名称，用于自动阶段切换 */
  toolName?: string;
}

// ═══════════════════════════════════════════════════════
// 核心接口
// ═══════════════════════════════════════════════════════

/**
 * 业务插件
 *
 * 框架通过此接口获取所有业务相关信息：
 *   - systemPrompt → 注入 Agent
 *   - fields → 驱动 UI 表单渲染
 *   - tools → 注册到 Agent
 *   - validate → 表单校验
 *   - pipeline → 驱动 StatusBar 阶段指示器
 */
export interface BusinessPlugin {
  /** 唯一标识，用于 URL 参数 / registry 查找 */
  id: string;

  /** 前端显示的标题 */
  displayName: string;

  /** 表单字段定义 */
  fields: FieldMeta[];

  /** Agent System Prompt（支持 ${config.maxFormRetries} 等变量） */
  systemPrompt: string;

  /** Agent Tools 列表 */
  tools: AgentTool<any>[];

  /** 表单校验函数 */
  validate(form: Record<string, string>): ValidationResult;

  /** 提交表单的 API（由 plugin 提供，框架通过 Tool 工厂调用） */
  submitApi: (form: Record<string, string>) => Promise<{ success: boolean; resultId?: string; message?: string; form?: Record<string, string> }>;

  /** 发起流程的 API */
  startProcessApi: (resultId: string, form: Record<string, string>) => Promise<{ success: boolean; processId?: string; message?: string }>;

  /** 确认阶段的文案 */
  confirmLabels?: {
    submit?: string;
    start?: string;
  };

  /** 流水线阶段定义（可选，使用默认则从 fields 推导） */
  pipeline?: PipelineStep[];

  /** 展示前格式化表单数据（可选） */
  formatFormForDisplay?(form: Record<string, string>): Record<string, string>;
}

/** 插件注册表类型 */
export type PluginRegistry = Record<string, BusinessPlugin>;
