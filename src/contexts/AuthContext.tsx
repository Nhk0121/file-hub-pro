import React, { createContext, useContext, useState, useCallback } from 'react';
import type { User, UserRole } from '@/types';

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
    role: '管理員',
    department: '00.處長室',
  },
  {
    id: '2',
    username: 'user',
    password: 'user123',
    displayName: '一般使用者',
    email: 'user@example.com',
    role: '使用者',
    department: '02.設計組',
    section: '資訊課',
  },
];

const getStoredUsers = (): StoredUser[] => {
  const saved = localStorage.getItem('dms_all_users');
  return saved ? JSON.parse(saved) : DEFAULT_USERS;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dms_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [storedUsers, setStoredUsers] = useState<StoredUser[]>(getStoredUsers);

  const allUsers: User[] = storedUsers.map(({ password, ...u }) => u);

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
    // 如果是當前使用者，更新 session
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

  return (
    <AuthContext.Provider value={{
      user, isAuthenticated: !!user, allUsers,
      login, logout, addUser, removeUser, updateUser, updateUserRole, updateProfile,
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
