/**
 * 病假申请 — 表单字段定义
 */
import type { FieldMeta } from '../../domain/models/FieldMeta.js';

export const sickLeaveFields: FieldMeta[] = [
  { key: 'applicantName',  label: '申请人',       type: 'text',     required: true },
  { key: 'department',     label: '部门',         type: 'text',     required: true },
  { key: 'employeeId',     label: '工号',         type: 'text',     required: true },
  { key: 'startDate',      label: '请假开始日期',   type: 'date',     required: true },
  { key: 'endDate',        label: '请假结束日期',   type: 'date',     required: true },
  { key: 'diagnosis',      label: '诊断/病因',     type: 'textarea', required: true },
  { key: 'doctorNote',     label: '医生建议',      type: 'textarea', required: true },
  { key: 'hospital',       label: '就诊医院',      type: 'text' },
  { key: 'emergencyContact', label: '紧急联系人',   type: 'text',     required: true },
];
