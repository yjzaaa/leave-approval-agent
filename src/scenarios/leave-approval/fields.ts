/**
 * 远程办公审批 — 表单字段定义
 */
import type { FieldMeta } from '../../shared/scenario.js';

export const leaveFields: FieldMeta[] = [
  { key: 'applicantName',      label: '申请人',           type: 'text',  required: true },
  { key: 'department',         label: '部门',             type: 'text',  required: true },
  { key: 'employeeId',         label: '工号',             type: 'text',  required: true },
  { key: 'remoteStartDate',    label: '开始日期',          type: 'date',  required: true, placeholder: 'YYYY-MM-DD' },
  { key: 'remoteEndDate',      label: '结束日期',          type: 'date',  required: true, placeholder: 'YYYY-MM-DD' },
  { key: 'reason',             label: '申请原因',          type: 'textarea', required: true },
  { key: 'workPlan',           label: '工作安排',          type: 'textarea', required: true },
  { key: 'emergencyContact',   label: '紧急联系方式',      type: 'text',  required: true },
  { key: 'address',            label: '办公地址',          type: 'text' },
];
