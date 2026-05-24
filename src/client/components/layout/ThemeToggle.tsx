import React from 'react';
import { useTheme } from '../../../components/ThemeProvider';
import { Button } from '../../../components/ui/button';
import { Tooltip } from '../ui/Tooltip';
import { Sun, Moon, Monitor } from 'lucide-react';

/**
 * 主题切换按钮
 * 使用 ThemeProvider (vite-ui-theme localStorage key)
 * 循环切换: light → dark → system
 */
export const ThemeToggle: React.FC<{ userId?: string }> = ({ userId: _userId }) => {
  const { theme, setTheme } = useTheme();

  const cycle = () => {
    setTheme(theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light');
  };

  const icon = theme === 'dark'
    ? <Sun className="w-4 h-4" />
    : theme === 'light'
      ? <Moon className="w-4 h-4" />
      : <Monitor className="w-4 h-4" />;

  const label = theme === 'dark' ? '暗色' : theme === 'light' ? '亮色' : '跟随系统';

  return (
    <Tooltip text={`主题：${label}（点击切换）`} position="bottom">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-9 w-9"
        onClick={cycle}
        aria-label={`主题切换，当前：${label}`}
      >
        {icon}
      </Button>
    </Tooltip>
  );
};
