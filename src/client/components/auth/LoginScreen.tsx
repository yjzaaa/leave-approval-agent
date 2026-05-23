import React from 'react';
import { MOCK_USERS, type MockUser } from '../../data/users';

interface Props {
  onLogin: (userId: string) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => (
  <div className="login-screen">
    <div className="login-card">
      <h1 className="login-title">审批助手</h1>
      <p className="login-subtitle">选择用户登录</p>
      <div className="login-users">
        {MOCK_USERS.map(user => (
          <button
            key={user.id}
            className="login-user-card"
            onClick={() => onLogin(user.id)}
          >
            <span className="login-user-avatar">{user.avatar}</span>
            <span className="login-user-name">{user.name}</span>
            <span className="login-user-dept">{user.department}</span>
            <span className="login-user-role">{roleLabel(user.role)}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

function roleLabel(role: MockUser['role']): string {
  switch (role) {
    case 'employee': return '员工';
    case 'manager': return '主管';
    case 'admin': return '管理员';
  }
}
