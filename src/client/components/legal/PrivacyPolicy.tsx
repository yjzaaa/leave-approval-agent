import React from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 隐私政策 — 企业合规必需 */
export const PrivacyPolicy: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-lg max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold leading-none tracking-tight">隐私政策</h2>
          <button onClick={onClose} className="rounded-full h-8 w-8 inline-flex items-center justify-center hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar text-sm space-y-4 leading-relaxed">
          <p><strong>最后更新日期：</strong>2026 年 5 月</p>

          <h3 className="font-semibold text-base mt-6 mb-2">1. 信息收集</h3>
          <p>本系统在运行过程中可能收集以下信息：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>用户身份信息：</strong>用户 ID、姓名、部门等用于审批流程所需的身份标识。</li>
            <li><strong>申请内容：</strong>用户在审批表单中填写的业务数据（如请假事由、报销明细等）。</li>
            <li><strong>对话记录：</strong>用户与 AI 助手的交互记录，用于改进服务质量。</li>
            <li><strong>设备信息：</strong>浏览器类型、操作系统版本等基础设备信息。</li>
          </ul>

          <h3 className="font-semibold text-base mt-6 mb-2">2. 信息使用</h3>
          <p>收集的信息仅用于以下目的：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>处理审批申请并生成审批结果。</li>
            <li>优化 AI 助手的响应准确性和用户体验。</li>
            <li>满足企业内部的合规审计要求。</li>
          </ul>
          <p>我们不会将您的信息用于上述目的之外的任何用途，也不会出售或共享给第三方。</p>

          <h3 className="font-semibold text-base mt-6 mb-2">3. 信息存储与安全</h3>
          <p>所有数据存储在企业的安全服务器上，采用以下安全措施：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>传输层加密（TLS 1.3）。</li>
            <li>基于角色的访问控制（RBAC）。</li>
            <li>定期的安全审计和漏洞扫描。</li>
            <li>数据备份和灾难恢复机制。</li>
          </ul>

          <h3 className="font-semibold text-base mt-6 mb-2">4. 用户权利</h3>
          <p>您对自己的数据拥有以下权利：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>访问权：</strong>您可以查看系统中存储的与您相关的个人数据。</li>
            <li><strong>更正权：</strong>您可以要求更正不准确的个人数据。</li>
            <li><strong>删除权：</strong>在法律允许的范围内，您可以要求删除您的个人数据。</li>
            <li><strong>数据可携带权：</strong>您可以申请导出您的数据副本。</li>
          </ul>

          <h3 className="font-semibold text-base mt-6 mb-2">5. Cookie 使用</h3>
          <p>本系统使用必要的 Cookie 来维护用户会话状态和界面偏好设置（如主题选择）。这些 Cookie 不用于跟踪或广告目的。</p>

          <h3 className="font-semibold text-base mt-6 mb-2">6. 联系方式</h3>
          <p>如果您对本隐私政策有任何疑问，或希望行使您的数据权利，请联系：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>数据保护官：</strong>dpo@company.com</li>
            <li><strong>IT 支持：</strong>it-support@company.com</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
