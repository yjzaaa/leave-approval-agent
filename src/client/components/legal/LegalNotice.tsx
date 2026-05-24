import React from 'react';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

/** 法律声明 — 企业合规必需 */
export const LegalNotice: React.FC<Props> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-lg max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold leading-none tracking-tight">法律声明</h2>
          <button onClick={onClose} className="rounded-full h-8 w-8 inline-flex items-center justify-center hover:bg-accent transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar text-sm space-y-4 leading-relaxed">
          <h3 className="font-semibold text-base mt-2 mb-2">1. 服务性质</h3>
          <p>本系统（"审批助手"）是一个基于人工智能技术的办公审批辅助工具。系统提供的审批建议和分析结果仅供参考，不构成法律、财务或任何形式的专业建议。最终的审批决定应由具有相应权限的人员根据实际情况做出。</p>

          <h3 className="font-semibold text-base mt-6 mb-2">2. 免责声明</h3>
          <ul className="list-disc pl-5 space-y-1">
            <li>本系统基于 AI 模型生成回复，可能包含不准确或不完整的信息。用户应独立核实关键信息。</li>
            <li>对于因使用本系统而产生的任何直接或间接损失，在法律允许的最大范围内，本系统提供方不承担责任。</li>
            <li>系统可能因维护、升级或不可抗力因素而暂时不可用，提供方不保证服务的连续性和无错误性。</li>
          </ul>

          <h3 className="font-semibold text-base mt-6 mb-2">3. 知识产权</h3>
          <p>本系统的软件代码、界面设计、商标和文档均受知识产权法律保护。未经授权，不得复制、修改、分发或创建衍生作品。</p>
          <p>用户在使用过程中输入的内容和生成的审批结果的知识产权归属，按照企业内部相关规定执行。</p>

          <h3 className="font-semibold text-base mt-6 mb-2">4. 使用规范</h3>
          <p>用户在使用本系统时应遵守以下规范：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>不得利用本系统从事违法活动或提交违法内容。</li>
            <li>不得尝试绕过系统的安全机制或访问未经授权的数据。</li>
            <li>不得对系统进行逆向工程、反编译或试图获取源代码。</li>
            <li>不得使用自动化工具对系统进行大规模请求或压力测试。</li>
          </ul>

          <h3 className="font-semibold text-base mt-6 mb-2">5. 数据合规</h3>
          <p>本系统的数据收集和处理遵循以下法律法规：</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>《中华人民共和国个人信息保护法》（PIPL）</li>
            <li>《中华人民共和国数据安全法》</li>
            <li>《中华人民共和国网络安全法》</li>
            <li>企业内部信息安全管理制度</li>
          </ul>

          <h3 className="font-semibold text-base mt-6 mb-2">6. 协议变更</h3>
          <p>本法律声明可能不时更新。更新后的版本将在系统中发布，并在生效前通过适当方式通知用户。继续使用本系统即表示您接受更新后的条款。</p>

          <h3 className="font-semibold text-base mt-6 mb-2">7. 适用法律与争议解决</h3>
          <p>本声明受中华人民共和国法律管辖。因本声明引起的争议，双方应首先通过友好协商解决；协商不成的，提交有管辖权的人民法院解决。</p>
        </div>
      </div>
    </div>
  );
};
