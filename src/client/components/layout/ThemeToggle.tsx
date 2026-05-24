import React from 'react';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../../components/ThemeProvider';
import { Button } from '../../../components/ui/button';
import { Tooltip } from '../ui/Tooltip';
import { Sun, Moon, Monitor } from 'lucide-react';

export const ThemeToggle: React.FC<{ userId?: string }> = ({ userId: _userId }) => {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  };

  const icon = theme === 'dark'
    ? <Sun className="w-4 h-4" />
    : theme === 'light'
      ? <Moon className="w-4 h-4" />
      : <Monitor className="w-4 h-4" />;

  const label = theme === 'dark' ? t('theme.dark') : theme === 'light' ? t('theme.light') : t('theme.system');

  return (
    <Tooltip text={t('theme.toggleTooltip', { label })} position="bottom">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-9 w-9"
        onClick={cycle}
        aria-label={t('theme.toggleAriaLabel', { label })}
      >
        {icon}
      </Button>
    </Tooltip>
  );
};
