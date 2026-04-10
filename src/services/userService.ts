import authService from './authService';
import type { User, UserRole, UserRegistration } from '@/types';

const REGISTRATIONS_KEY = 'dms_registrations';

function getRegistrations(): UserRegistration[] {
  const saved = localStorage.getItem(REGISTRATIONS_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveRegistrations(regs: UserRegistration[]) {
  localStorage.setItem(REGISTRATIONS_KEY, JSON.stringify(regs));
}

const userService = {
  getAll: async (): Promise<User[]> => {
    return authService._getAllUsers();
  },

  create: async (userData: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const users = authService._getAllUsers();
    const passwords = authService._getPasswords();
    const { password, ...rest } = userData as any;
    const newUser: User = { id: crypto.randomUUID(), ...rest };
    users.push(newUser);
    passwords[newUser.id] = password;
    authService._saveUsers(users);
    authService._savePasswords(passwords);
    return newUser;
  },

  update: async (userId: string, updates: Partial<User>): Promise<User> => {
    const users = authService._getAllUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx < 0) throw new Error('使用者不存在');
    users[idx] = { ...users[idx], ...updates };
    authService._saveUsers(users);
    return users[idx];
  },

  remove: async (userId: string): Promise<void> => {
    let users = authService._getAllUsers();
    const passwords = authService._getPasswords();
    users = users.filter(u => u.id !== userId);
    delete passwords[userId];
    authService._saveUsers(users);
    authService._savePasswords(passwords);
  },

  updateRole: async (userId: string, role: UserRole): Promise<void> => {
    const users = authService._getAllUsers();
    const idx = users.findIndex(u => u.id === userId);
    if (idx < 0) throw new Error('使用者不存在');
    users[idx].role = role;
    authService._saveUsers(users);
  },

  resetPassword: async (userId: string): Promise<void> => {
    const passwords = authService._getPasswords();
    passwords[userId] = 'a0123456789+';
    authService._savePasswords(passwords);
  },

  getRegistrations: async (): Promise<UserRegistration[]> => {
    return getRegistrations();
  },

  submitRegistration: async (reg: Omit<UserRegistration, 'id' | 'status' | 'createdAt'>): Promise<void> => {
    const regs = getRegistrations();
    regs.unshift({
      ...reg,
      id: crypto.randomUUID(),
      status: '待審核',
      createdAt: new Date().toISOString(),
    });
    saveRegistrations(regs);
  },

  reviewRegistration: async (
    regId: string,
    status: '已核准' | '已拒絕',
    reviewerName: string,
    rejectReason?: string
  ): Promise<void> => {
    const regs = getRegistrations();
    const reg = regs.find(r => r.id === regId);
    if (!reg) throw new Error('申請不存在');
    reg.status = status;
    reg.reviewedBy = reviewerName;
    reg.reviewedAt = new Date().toISOString();
    if (rejectReason) reg.rejectReason = rejectReason;

    // 核准時自動建立帳號
    if (status === '已核准') {
      const users = authService._getAllUsers();
      const passwords = authService._getPasswords();
      const newUser: User = {
        id: crypto.randomUUID(),
        username: reg.username,
        displayName: reg.displayName,
        email: reg.email,
        role: reg.applicantType === '外包人員' ? '外包人員' : '使用者',
        applicantType: reg.applicantType,
        department: reg.department,
        section: reg.section,
        jobTitle: reg.jobTitle,
        phone: reg.phone,
        extension: reg.extension,
      };
      users.push(newUser);
      passwords[newUser.id] = reg.password;
      authService._saveUsers(users);
      authService._savePasswords(passwords);
    }

    saveRegistrations(regs);
  },
};

export default userService;
