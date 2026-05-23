/**
 * 工作流引擎 - 状态机驱动的审批流程核心
 * 
 * 流程：用户输入 → LLM填表 → 校验循环 → 用户确认表单 → 提交获取ID 
 *       → 填入ID生成流程表单 → 用户确认流程 → 发起流程 → 返回结果
 */
import { FormValidator } from '../validator/index.js';
import { LLMService } from '../llm/index.js';
import { apiClient } from '../api/index.js';
import { WorkflowState } from '../types.js';
import type { LeaveForm, WorkflowContext } from '../types.js';

/** 流程发起表单 = 申请表单 + formId */
export interface ProcessForm {
  formId: string;
  applicantName: string;
  department: string;
  employeeId: string;
  remoteStartDate: string;
  remoteEndDate: string;
  reason: string;
  workPlan: string;
  emergencyContact: string;
  address: string;
}

export class WorkflowEngine {
  private llm: LLMService;
  private validator: FormValidator;
  private ctx: WorkflowContext;

  constructor(maxRetries = 5) {
    this.llm = new LLMService();
    this.validator = new FormValidator();
    this.ctx = {
      state: WorkflowState.COLLECTING,
      userInput: '',
      validationErrors: [],
      retryCount: 0,
      maxRetries,
    };
  }

  get context(): Readonly<WorkflowContext> {
    return this.ctx;
  }

  /**
   * 执行完整的审批工作流
   * 
   * @param userInput 用户的自然语言输入
   * @param onConfirmForm 第一次确认：校验通过的申请表单
   * @param onConfirmProcess 第二次确认：带 formId 的完整流程表单
   * @returns 最终结果消息
   */
  async run(
    userInput: string,
    onConfirmForm: (form: LeaveForm) => Promise<boolean>,
    onConfirmProcess: (processForm: ProcessForm) => Promise<boolean>,
  ): Promise<{ success: boolean; message: string }> {

    // ── Phase 1: LLM 填表 + 校验循环 ──────────────────────────
    this.ctx.userInput = userInput;
    this.ctx.state = WorkflowState.FILLING_FORM;
    this.ctx.retryCount = 0;

    let form = await this.llm.fillForm(userInput);
    this.ctx.form = form;
    this.ctx.state = WorkflowState.VALIDATING;

    while (true) {
      const result = this.validator.validate(this.ctx.form!);
      this.ctx.validationErrors = result.errors;

      if (result.valid) {
        this.ctx.state = WorkflowState.AWAITING_CONFIRM;
        break;
      }

      this.ctx.retryCount++;
      if (this.ctx.retryCount > this.ctx.maxRetries) {
        this.ctx.state = WorkflowState.FAILED;
        return {
          success: false,
          message: `表单自动修正失败（已重试 ${this.ctx.maxRetries} 次），错误如下：\n${result.errors.map(e => `  - ${e}`).join('\n')}\n\n请重新描述您的申请需求。`,
        };
      }

      console.log(`\n⚠️  校验失败 (第 ${this.ctx.retryCount} 次修正):`);
      result.errors.forEach(e => console.log(`  - ${e}`));

      this.ctx.state = WorkflowState.FILLING_FORM;
      form = await this.llm.fillForm(userInput, this.ctx.form, result.errors);
      this.ctx.form = form;
      this.ctx.state = WorkflowState.VALIDATING;
    }

    // ── Phase 2: 第一次用户确认 — 确认申请表单 ─────────────────
    console.log('\n📋 ━━━ 第一次确认：申请表单 ━━━');
    this.printForm(this.ctx.form!);

    const formConfirmed = await onConfirmForm(this.ctx.form!);
    if (!formConfirmed) {
      this.ctx.state = WorkflowState.COLLECTING;
      return { success: false, message: '已取消申请。' };
    }

    // ── Phase 3: 提交表单，获取 formId ─────────────────────────
    this.ctx.state = WorkflowState.SUBMITTING;
    const submitResult = await apiClient.submitForm(this.ctx.form!);
    if (!submitResult.success) {
      this.ctx.state = WorkflowState.FAILED;
      return {
        success: false,
        message: `表单提交失败：${submitResult.errors?.join('; ') ?? '未知错误'}`,
      };
    }
    this.ctx.formId = submitResult.formId;

    // ── Phase 4: 生成流程表单（包含 formId）────────────────────
    const processForm: ProcessForm = {
      formId: this.ctx.formId!,
      ...this.ctx.form!,
    };

    // ── Phase 5: 第二次用户确认 — 确认流程表单 ──────────────────
    console.log('\n📋 ━━━ 第二次确认：流程发起表单 ━━━');
    this.printProcessForm(processForm);

    this.ctx.state = WorkflowState.AWAITING_CONFIRM;
    const processConfirmed = await onConfirmProcess(processForm);
    if (!processConfirmed) {
      this.ctx.state = WorkflowState.COLLECTING;
      return { success: false, message: '流程已取消，但表单已提交（表单ID: ' + this.ctx.formId + '）。请联系管理员处理。' };
    }

    // ── Phase 6: 发起流程 ──────────────────────────────────────
    this.ctx.state = WorkflowState.STARTING_PROCESS;
    const processResult = await apiClient.startProcess(this.ctx.formId!, this.ctx.form!);
    if (!processResult.success) {
      this.ctx.state = WorkflowState.FAILED;
      return {
        success: false,
        message: `流程发起失败：${processResult.error ?? '未知错误'}\n表单ID: ${this.ctx.formId}（已提交，请联系管理员手动处理）`,
      };
    }
    this.ctx.processId = processResult.processId;
    this.ctx.state = WorkflowState.COMPLETED;

    return {
      success: true,
      message: processResult.message ?? `审批流程已成功发起！表单ID: ${this.ctx.formId}，流程ID: ${this.ctx.processId}`,
    };
  }

  /** 格式化输出申请表单 */
  private printForm(form: LeaveForm): void {
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│              远程办公申请表单                        │');
    console.log('├─────────────────────────────────────────────────────┤');
    console.log(`│  申请人:     ${form.applicantName}`);
    console.log(`│  部门:       ${form.department}`);
    console.log(`│  工号:       ${form.employeeId}`);
    console.log(`│  开始日期:   ${form.remoteStartDate}`);
    console.log(`│  结束日期:   ${form.remoteEndDate}`);
    console.log(`│  原因:       ${form.reason}`);
    console.log(`│  工作安排:   ${form.workPlan}`);
    console.log(`│  联系方式:   ${form.emergencyContact}`);
    console.log(`│  办公地址:   ${form.address}`);
    console.log('└─────────────────────────────────────────────────────┘');
  }

  /** 格式化输出流程表单（带 formId）*/
  private printProcessForm(pf: ProcessForm): void {
    console.log('┌─────────────────────────────────────────────────────┐');
    console.log('│           流程发起表单（含表单ID）                   │');
    console.log('├─────────────────────────────────────────────────────┤');
    console.log(`│  表单ID:     ${pf.formId}`);
    console.log(`│  申请人:     ${pf.applicantName}`);
    console.log(`│  部门:       ${pf.department}`);
    console.log(`│  工号:       ${pf.employeeId}`);
    console.log(`│  开始日期:   ${pf.remoteStartDate}`);
    console.log(`│  结束日期:   ${pf.remoteEndDate}`);
    console.log(`│  原因:       ${pf.reason}`);
    console.log(`│  工作安排:   ${pf.workPlan}`);
    console.log(`│  联系方式:   ${pf.emergencyContact}`);
    console.log(`│  办公地址:   ${pf.address}`);
    console.log('└─────────────────────────────────────────────────────┘');
  }
}
