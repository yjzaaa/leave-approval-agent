/**
 * 模拟登录状态管理
 *
 * 读写 localStorage `current_user_id`。
 * 未登录时 user 为 null，登录后为 MockUser 对象。
 */
import { useState, useCallback } from 'react';
import { MOCK_USERS, type MockUser } from '../data/users';

const CURRENT_USER_KEY = 'current_user_id';

function loadCurrentUser(): MockUser | null {
  try {
    const id = localStorage.getItem(CURRENT_USER_KEY);
    if (!id) return null;
    return MOCK_USERS.find(u => u.id === id) ?? null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [user, setUser] = useState<MockUser | null>(loadCurrentUser);

  const login = useCallback((userId: string) => {
    const found = MOCK_USERS.find(u => u.id === userId);
    if (!found) return;
    localStorage.setItem(CURRENT_USER_KEY, userId);
    setUser(found);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(CURRENT_USER_KEY);
    setUser(null);
  }, []);

  return { user, login, logout };
}
