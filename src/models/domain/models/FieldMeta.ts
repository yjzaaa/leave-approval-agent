/**
 * 表单字段元信息
 */
export interface FieldMeta {
  /** 字段键名 */
  key: string;
  /** 显示标签 */
  label: string;
  /** 输入类型 */
  type: 'text' | 'date' | 'select' | 'textarea';
  /** 是否必填 */
  required?: boolean;
  /** 占位提示 */
  placeholder?: string;
}
