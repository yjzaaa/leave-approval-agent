/** 模拟用户数据 */
export interface MockUser {
  id: string;
  name: string;
  role: 'employee' | 'manager' | 'admin';
  department: string;
  avatar: string;
}

export const MOCK_USERS: MockUser[] = [
  { id: 'zhangsan', name: '张三', role: 'employee', department: '技术部', avatar: '👨‍💻' },
  { id: 'lisi',     name: '李四', role: 'manager',  department: '产品部', avatar: '👩‍💼' },
  { id: 'wangwu',   name: '王五', role: 'employee', department: '设计部', avatar: '🎨' },
  { id: 'admin',    name: '管理员', role: 'admin',   department: '管理层', avatar: '🏢' },
];
