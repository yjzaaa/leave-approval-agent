import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Tooltip } from '../ui/Tooltip';

export const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language.startsWith('zh');

  const toggle = () => {
    i18n.changeLanguage(isZh ? 'en' : 'zh-CN');
  };

  return (
    <Tooltip text={t('language.switchTo')} position="bottom">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-9 w-9 text-xs font-semibold"
        onClick={toggle}
        aria-label={t('language.switchTo')}
      >
        {t('language.label')}
      </Button>
    </Tooltip>
  );
};