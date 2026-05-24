import React from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
}

interface LegalSection {
  heading: string;
  body: string;
  items: string[];
}

export const PrivacyPolicy: React.FC<Props> = ({ open, onClose }) => {
  const { t } = useTranslation();
  if (!open) return null;

  const sections = t('legal.privacySections', { returnObjects: true }) as unknown as LegalSection[];

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="rounded-lg border border-border bg-card text-card-foreground shadow-lg max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border">
          <h2 className="text-lg font-semibold leading-none tracking-tight">{t('legal.privacyTitle')}</h2>
          <button onClick={onClose} className="rounded-full h-8 w-8 inline-flex items-center justify-center hover:bg-accent transition-colors" aria-label={t('legal.close')}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto custom-scrollbar text-sm space-y-4 leading-relaxed">
          <p className="text-muted-foreground">{t('legal.lastUpdated')}</p>
          {sections.map((section, i) => (
            <div key={i}>
              <h3 className="font-semibold text-base mt-6 mb-2">{section.heading}</h3>
              {section.body && <p>{section.body}</p>}
              {section.items.length > 0 && (
                <ul className="list-disc pl-5 space-y-1">
                  {section.items.map((item, j) => <li key={j}>{item}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};