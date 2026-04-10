import type { User, ApplicantType } from '@/types';

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegistrationPayload {
  applicantType: ApplicantType;
  username: string;
  password: string;
  displayName: string;
  email: string;
  department?: string;
  section?: string;
  jobTitle?: string;
  phone?: string;
  extension?: string;
}

const USERS_KEY = 'dms_users';
const PASSWORDS_KEY = 'dms_passwords';

/** 取得所有使用者（含預設 admin） */
function getAllUsers(): User[] {
  const saved = localStorage.getItem(USERS_KEY);
  if (saved) return JSON.parse(saved);
  // 預設系統管理員
  const defaultAdmin: User = {
    id: 'admin-default',
    username: 'admin',
    displayName: '系統管理員',
    email: '',
    role: '系統管理員',
    applicantType: '公司員工',
  };
  localStorage.setItem(USERS_KEY, JSON.stringify([defaultAdmin]));
  localStorage.setItem(PASSWORDS_KEY, JSON.stringify({ 'admin-default': 'admin123' }));
  return [defaultAdmin];
}

function getPasswords(): Record<string, string> {
  const saved = localStorage.getItem(PASSWORDS_KEY);
  return saved ? JSON.parse(saved) : {};
}

const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const users = getAllUsers();
    const passwords = getPasswords();
    const found = users.find(u => u.username === username);
    if (!found || passwords[found.id] !== password) {
      throw new Error('帳號或密碼錯誤');
    }
    const token = `mock-token-${Date.now()}`;
    localStorage.setItem('dms_token', token);
    return { token, user: found };
  },

  logout: async (): Promise<void> => {
    localStorage.removeItem('dms_token');
    localStorage.removeItem('dms_user');
  },

  getProfile: async (): Promise<User> => {
    const saved = localStorage.getItem('dms_user');
    if (!saved) throw new Error('未登入');
    return JSON.parse(saved);
  },

  updateProfile: async (updates: Partial<User>): Promise<User> => {
    const saved = localStorage.getItem('dms_user');
    if (!saved) throw new Error('未登入');
    const current: User = JSON.parse(saved);
    const updated = { ...current, ...updates };
    // 同步更新 users 列表
    const users = getAllUsers();
    const idx = users.findIndex(u => u.id === updated.id);
    if (idx >= 0) {
      users[idx] = updated;
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return updated;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    const saved = localStorage.getItem('dms_user');
    if (!saved) throw new Error('未登入');
    const current: User = JSON.parse(saved);
    const passwords = getPasswords();
    if (passwords[current.id] !== oldPassword) {
      throw new Error('舊密碼錯誤');
    }
    passwords[current.id] = newPassword;
    localStorage.setItem(PASSWORDS_KEY, JSON.stringify(passwords));
  },

  /** 內部用：取得/設定使用者列表與密碼 */
  _getAllUsers: getAllUsers,
  _getPasswords: getPasswords,
  _saveUsers: (users: User[]) => localStorage.setItem(USERS_KEY, JSON.stringify(users)),
  _savePasswords: (pw: Record<string, string>) => localStorage.setItem(PASSWORDS_KEY, JSON.stringify(pw)),
};

export default authService;
