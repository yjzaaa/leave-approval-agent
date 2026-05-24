import React from 'react';
import { MOCK_USERS, type MockUser } from '../../data/users';
import { MessageSquare, User, ChevronRight } from 'lucide-react';

interface Props {
  onLogin: (userId: string) => void;
}

export const LoginScreen: React.FC<Props> = ({ onLogin }) => (
  <div className="flex h-dvh items-center justify-center bg-background p-4">
    <div className="w-full max-w-sm">
      <div className="flex flex-col items-center mb-8">
        <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-sm">
          <MessageSquare className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">审批助手</h1>
        <p className="text-sm text-muted-foreground mt-1">企业内部审批 · 选择用户登录</p>
      </div>
      <div className="space-y-2">
        {MOCK_USERS.map(user => (
          <button
            key={user.id}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all text-left group"
            onClick={() => onLogin(user.id)}
          >
            <div className="flex items-center justify-center w-9 h-9 rounded-full bg-muted shrink-0">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-medium text-card-foreground">{user.name}</span>
              <span className="text-xs text-muted-foreground ml-2">{user.department}</span>
            </div>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">{roleLabel(user.role)}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/30 shrink-0 group-hover:text-primary transition-colors" />
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-6">© 2026 审批助手 v2.1 — Enterprise Edition</p>
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
