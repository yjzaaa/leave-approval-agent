/**
 * 应用入口壳 — 登录判断 + ThemeProvider 包裹
 */
import { useAuth } from './views/hooks/useAuth';
import { LoginScreen } from './views/components/auth/LoginScreen';
import { ThemeProvider } from './views/components/ui/ThemeProvider';
import { MainApp } from './views/components/layout/MainApp';

/** 根组件 — 未登录显示登录页，已登录进入主界面 */
export default function App() {
  const { user, login, logout } = useAuth();

  if (!user) {
    return <LoginScreen onLogin={login} />;
  }

  return (
    <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <MainApp key={user.id} user={user} onLogout={logout} />
    </ThemeProvider>
  );
}
