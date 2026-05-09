import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import type { User, UserRole, UserRegistration, RegistrationStatus, ApplicantType } from '@/types';
import authService from '@/services/authService';
import userService from '@/services/userService';
import { sessionStore, IDLE_TIMEOUT_MS } from '@/lib/sessionStorage';
import { toast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  allUsers: User[];
  loading: boolean;
  login: (username: string, password: string) => Promise<{ ok: boolean; suspended?: boolean; message?: string }>;
  logout: () => void;
  addUser: (user: User, password: string) => Promise<void>;
  removeUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  suspendUser: (userId: string, suspended: boolean, reason?: string) => Promise<void>;
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
  const [user, setUser] = useState<User | null>(() => sessionStore.getUser<User>());
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [registrations, setRegistrations] = useState<UserRegistration[]>([]);
  const [loading, setLoading] = useState(false);
  const idleTimerRef = useRef<number | null>(null);

  // 初始化：如有 token 則驗證並載入資料
  useEffect(() => {
    const token = sessionStore.getToken();
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

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setAllUsers([]);
    setRegistrations([]);
  }, []);

  // 閒置自動登出：10 分鐘無操作即登出
  useEffect(() => {
    if (!user) return;

    const resetTimer = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => {
        toast({
          title: '閒置自動登出',
          description: '您已 10 分鐘未操作，為保護資料安全已自動登出。',
          variant: 'destructive',
        });
        logout().then(() => {
          window.location.href = '/login';
        });
      }, IDLE_TIMEOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click',
    ];
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, logout]);

  const login = useCallback(async (username: string, password: string) => {
    try {
      setLoading(true);
      const { token, user: userData } = await authService.login(username, password);
      setUser(userData);
      sessionStore.setUser(userData);
      await refreshUsers();
      await loadRegistrations();
      return { ok: true };
    } catch (err: any) {
      const status = err?.response?.status;
      const data = err?.response?.data;
      if (status === 403 && data?.suspended) {
        return { ok: false, suspended: true, message: data?.message || '您的帳號因違規遭受停權處分，請聯絡系統管理員。' };
      }
      return { ok: false, message: data?.message };
    } finally {
      setLoading(false);
    }
  }, [refreshUsers, loadRegistrations]);

  const suspendUser = useCallback(async (userId: string, suspended: boolean, reason?: string) => {
    await userService.suspend(userId, suspended, reason);
    await refreshUsers();
  }, [refreshUsers]);

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
        sessionStore.setUser(updated);
        return updated;
      }
      return prev;
    });
  }, [refreshUsers]);

  const updateProfile = useCallback(async (updates: Partial<User>) => {
    const updated = await authService.updateProfile(updates);
    setUser(updated);
    sessionStore.setUser(updated);
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
      login, logout, addUser, removeUser, updateUser, suspendUser, updateUserRole, updateProfile, resetPassword,
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
