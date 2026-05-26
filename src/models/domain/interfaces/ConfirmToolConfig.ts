/**
 * HITL 确认 tool 配置
 *
 * 将 tool 名称与确认文案绑定在一起，避免 confirmTools + confirmLabels 的字符串隐式耦合。
 */
export interface ConfirmToolConfig {
  /** 需要用户确认的 tool 名称 */
  name: string;
  /** 确认弹窗标题 */
  label?: string;
}
