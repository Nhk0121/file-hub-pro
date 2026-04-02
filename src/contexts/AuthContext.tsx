import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, UserRole, UserRegistration, RegistrationStatus, ApplicantType } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  allUsers: User[];
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: User, password: string) => void;
  removeUser: (userId: string) => void;
  updateUser: (userId: string, updates: Partial<User>) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  updateProfile: (updates: Partial<User>) => void;
  resetPassword: (userId: string) => void;
  // 帳號申請
  registrations: UserRegistration[];
  submitRegistration: (reg: Omit<UserRegistration, 'id' | 'status' | 'createdAt'>) => void;
  reviewRegistration: (regId: string, status: '已核准' | '已拒絕', reviewerName: string, rejectReason?: string) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface StoredUser extends User {
  password: string;
}

const DEFAULT_USERS: StoredUser[] = [
  {
    id: '1',
    username: 'admin',
    password: 'admin123',
    displayName: '系統管理員',
    email: 'admin@example.com',
    role: '系統管理員',
    department: '00.處長室',
  },
  {
    id: '2',
    username: 'user',
    password: 'user123',
    displayName: '一般使用者',
    email: 'user@example.com',
    role: '使用者',
    applicantType: '公司員工',
    department: '02.設計組',
    section: '04.資訊課',
  },
];

const getStoredUsers = (): StoredUser[] => {
  const saved = localStorage.getItem('dms_all_users');
  const users: StoredUser[] = saved ? JSON.parse(saved) : DEFAULT_USERS;
  // 強制確保 admin 帳號為系統管理員
  let changed = false;
  const fixed = users.map(u => {
    if (u.username === 'admin' && u.role !== '系統管理員') {
      changed = true;
      return { ...u, role: '系統管理員' as const };
    }
    return u;
  });
  if (changed) {
    localStorage.setItem('dms_all_users', JSON.stringify(fixed));
  }
  return fixed;
};

const getStoredRegistrations = (): UserRegistration[] => {
  const saved = localStorage.getItem('dms_registrations');
  return saved ? JSON.parse(saved) : [];
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dms_user');
    if (saved) {
      const u = JSON.parse(saved);
      // 強制修正 admin 角色
      if (u.username === 'admin' && u.role !== '系統管理員') {
        u.role = '系統管理員';
        localStorage.setItem('dms_user', JSON.stringify(u));
      }
      return u;
    }
    return null;
  });
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>(getStoredUsers);
  const [registrations, setRegistrations] = useState<UserRegistration[]>(getStoredRegistrations);

  const allUsers: User[] = storedUsers.map(({ password, ...u }) => u);

  const saveRegistrations = (regs: UserRegistration[]) => {
    setRegistrations(regs);
    localStorage.setItem('dms_registrations', JSON.stringify(regs));
  };

  const login = useCallback(async (username: string, password: string) => {
    const users = getStoredUsers();
    const found = users.find(u => u.username === username && u.password === password);
    if (found) {
      const { password: _, ...userData } = found;
      setUser(userData);
      localStorage.setItem('dms_user', JSON.stringify(userData));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('dms_user');
  }, []);

  const addUser = useCallback((newUser: User, password: string) => {
    setStoredUsers(prev => {
      const next = [...prev, { ...newUser, password }];
      localStorage.setItem('dms_all_users', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeUser = useCallback((userId: string) => {
    setStoredUsers(prev => {
      const next = prev.filter(u => u.id !== userId);
      localStorage.setItem('dms_all_users', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateUser = useCallback((userId: string, updates: Partial<User>) => {
    setStoredUsers(prev => {
      const next = prev.map(u => u.id === userId ? { ...u, ...updates } : u);
      localStorage.setItem('dms_all_users', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateUserRole = useCallback((userId: string, role: UserRole) => {
    setStoredUsers(prev => {
      const next = prev.map(u => u.id === userId ? { ...u, role } : u);
      localStorage.setItem('dms_all_users', JSON.stringify(next));
      return next;
    });
    setUser(prev => {
      if (prev && prev.id === userId) {
        const updated = { ...prev, role };
        localStorage.setItem('dms_user', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
  }, []);

  const updateProfile = useCallback((updates: Partial<User>) => {
    if (!user) return;
    const updatedUser = { ...user, ...updates };
    setUser(updatedUser);
    localStorage.setItem('dms_user', JSON.stringify(updatedUser));
    setStoredUsers(prev => {
      const next = prev.map(u => u.id === user.id ? { ...u, ...updates } : u);
      localStorage.setItem('dms_all_users', JSON.stringify(next));
      return next;
    });
  }, [user]);

  const resetPassword = useCallback((userId: string) => {
    setStoredUsers(prev => {
      const next = prev.map(u => u.id === userId ? { ...u, password: 'a0123456789+' } : u);
      localStorage.setItem('dms_all_users', JSON.stringify(next));
      return next;
    });
  }, []);

  const submitRegistration = useCallback((reg: Omit<UserRegistration, 'id' | 'status' | 'createdAt'>) => {
    const newReg: UserRegistration = {
      ...reg,
      id: crypto.randomUUID(),
      status: '待審核',
      createdAt: new Date().toISOString(),
    };
    saveRegistrations([newReg, ...registrations]);
  }, [registrations]);

  const reviewRegistration = useCallback((regId: string, status: '已核准' | '已拒絕', reviewerName: string, rejectReason?: string) => {
    const reg = registrations.find(r => r.id === regId);
    if (!reg) return;

    const next = registrations.map(r =>
      r.id === regId ? { ...r, status: status as RegistrationStatus, reviewedBy: reviewerName, reviewedAt: new Date().toISOString(), rejectReason } : r
    );
    saveRegistrations(next);

    // 核准時自動建立帳號
    if (status === '已核准') {
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
      setStoredUsers(prev => {
        const updated = [...prev, { ...newUser, password: reg.password }];
        localStorage.setItem('dms_all_users', JSON.stringify(updated));
        return updated;
      });
    }
  }, [registrations]);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, allUsers,
      login, logout, addUser, removeUser, updateUser, updateUserRole, updateProfile, resetPassword,
      registrations, submitRegistration, reviewRegistration,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
