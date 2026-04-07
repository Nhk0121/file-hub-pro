import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { User, UserRole, UserRegistration, RegistrationStatus, ApplicantType } from '@/types';
import authService from '@/services/authService';
import userService from '@/services/userService';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  allUsers: User[];
  loading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
  addUser: (user: User, password: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  resetPassword: (userId: string) => Promise<void>;
  registrations: UserRegistration[];
  submitRegistration: (reg: Omit<UserRegistration, 'id' | 'status' | 'createdAt'>) => Promise<void>;
  reviewRegistration: (regId: string, status: '已核准' | '已拒絕', reviewerName: string, rejectReason?: string) => Promise<void>;
  refreshUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dms_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [loading, setLoading] = useState(false);

  // 初始化：如有 token 則驗證並載入資料
  useEffect(() => {
    const token = localStorage.getItem('dms_token');
    if (token && user) {
      refreshUsers();
      loadRegistrations();
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const users = await userService.getAll();
      setAllUsers(users);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  }, []);

  const loadRegistrations = useCallback(async () => {
    try {
      const regs = await userService.getRegistrations();
      setRegistrations(regs);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    try {
      setLoading(true);
      const { token, user: userData } = await authService.login(username, password);
      setUser(userData);
      localStorage.setItem('dms_user', JSON.stringify(userData));
      // 登入後載入使用者列表
      await refreshUsers();
      await loadRegistrations();
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, [refreshUsers, loadRegistrations]);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setAllUsers([]);
    setRegistrations([]);
  }, []);

  const addUser = useCallback(async (newUser: User, password: string) => {
    await userService.create({ ...newUser, password } as any);
    await refreshUsers();
  }, [refreshUsers]);

  const removeUser = useCallback(async (userId: string) => {
    await userService.remove(userId);
    await refreshUsers();
  }, [refreshUsers]);

  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    await userService.update(userId, updates);
    await refreshUsers();
  }, [refreshUsers]);

  const updateUserRole = useCallback(async (userId: string, role: UserRole) => {
    await userService.updateRole(userId, role);
    await refreshUsers();
    // 如果更新的是自己
    setUser(prev => {
      if (prev && prev.id === userId) {
        const updated = { ...prev, role };
        localStorage.setItem('dms_user', JSON.stringify(updated));
        return updated;
      }
      return prev;
    });
  }, [refreshUsers]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    const updated = await authService.updateProfile(updates);
    setUser(updated);
    localStorage.setItem('dms_user', JSON.stringify(updated));
  }, []);

  const resetPassword = useCallback(async (userId: string) => {
    await userService.resetPassword(userId);
  }, []);

  const submitRegistration = useCallback(async (reg: Omit<UserRegistration, 'id' | 'status' | 'createdAt'>) => {
    await userService.submitRegistration(reg);
    await loadRegistrations();
  }, [loadRegistrations]);

  const reviewRegistration = useCallback(async (
    regId: string, status: '已核准' | '已拒絕', reviewerName: string, rejectReason?: string
  ) => {
    await userService.reviewRegistration(regId, status, reviewerName, rejectReason);
    await loadRegistrations();
    await refreshUsers();
  }, [loadRegistrations, refreshUsers]);

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, allUsers, loading,
      login, logout, addUser, removeUser, updateUser, updateUserRole, updateProfile, resetPassword,
      registrations, submitRegistration, reviewRegistration, refreshUsers,
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
