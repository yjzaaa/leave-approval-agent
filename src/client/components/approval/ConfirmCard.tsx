import React, { useEffect, useRef } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import type { ConfirmRequest } from '../../types';

interface Props {
  confirmRequest: ConfirmRequest;
  onConfirm: (approved: boolean) => void;
}

export const ConfirmCard: React.FC<Props> = ({ confirmRequest, onConfirm }) => {
  const { label, form, fieldLabels } = confirmRequest;
  const entries = Object.entries(fieldLabels).filter(([key]) => form[key] !== undefined);
  const overlayRef = useRef<HTMLDivElement>(null);
  const approveBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    approveBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onConfirm(false); return; }
      if (e.key === 'Tab' && overlayRef.current) {
        const focusable = overlayRef.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => { document.body.style.overflow = ''; document.removeEventListener('keydown', handleKeyDown); };
  }, [onConfirm]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onConfirm(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
      ref={overlayRef}
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-desc"
    >
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-start gap-3 mb-4">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
          <div>
            <div className="text-lg font-semibold leading-none tracking-tight" id="confirm-modal-title">{label}</div>
            <div className="text-sm text-muted-foreground mt-2" id="confirm-modal-desc">请仔细核对以下信息，确认无误后提交</div>
          </div>
        </div>
        <div className="space-y-2 mb-6" role="table" aria-label="申请信息摘要">
          {entries.map(([key, fieldLabel]) => (
            <div key={key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{fieldLabel}</span>
              <span className="font-medium text-foreground">{String(form[key] ?? '—')}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => onConfirm(false)}>
            <X className="h-4 w-4 mr-1" />
            拒绝
          </Button>
          <Button variant="default" onClick={() => onConfirm(true)} ref={approveBtnRef}>
            <Check className="h-4 w-4 mr-1" />
            确认提交
          </Button>
        </div>
      </div>
    </div>
  );
};
