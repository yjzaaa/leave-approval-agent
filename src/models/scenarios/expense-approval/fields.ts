/**
 * 报销审批 — 表单字段定义
 */
import type { FieldMeta } from '../../domain/models/FieldMeta.js';

export const expenseFields: FieldMeta[] = [
  { key: 'applicantName',  label: '申请人',       type: 'text',     required: true },
  { key: 'department',     label: '部门',         type: 'text',     required: true },
  { key: 'amount',         label: '报销金额(元)',   type: 'text',     required: true, placeholder: '例如: 1280.50' },
  { key: 'category',       label: '费用类别',      type: 'select',   required: true },
  { key: 'expenseDate',    label: '费用发生日期',   type: 'date',     required: true },
  { key: 'description',    label: '费用说明',      type: 'textarea', required: true },
  { key: 'receiptUrl',     label: '发票/凭证链接',  type: 'text' },
  { key: 'remark',         label: '备注',         type: 'textarea' },
];
