/**
 * 流水线步骤定义（驱动前端 StatusBar）
 */
export interface PipelineStep {
  /** 步骤键名 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 关联的 tool 名称，用于自动阶段切换 */
  toolName?: string;
}
