import React, { createContext, useContext, useState, useCallback } from 'react';
import type { FolderPermission, FolderPermissionRule } from '@/types';

interface PermissionContextType {
  rules: FolderPermissionRule[];
  setFolderPermission: (folderId: string, userId: string, permission: FolderPermission) => void;
  removeFolderPermission: (ruleId: string) => void;
  getFolderPermission: (folderId: string, userId: string) => FolderPermission;
  getFolderRules: (folderId: string) => FolderPermissionRule[];
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rules, setRules] = useState<FolderPermissionRule[]>(() => {
    const saved = localStorage.getItem('dms_permissions');
    return saved ? JSON.parse(saved) : [];
  });

  const save = (next: FolderPermissionRule[]) => {
    setRules(next);
    localStorage.setItem('dms_permissions', JSON.stringify(next));
  };

  const setFolderPermission = useCallback((folderId: string, userId: string, permission: FolderPermission) => {
    setRules(prev => {
      const existing = prev.findIndex(r => r.folderId === folderId && r.userId === userId);
      let next: FolderPermissionRule[];
      if (existing >= 0) {
        next = prev.map((r, i) => i === existing ? { ...r, permission } : r);
      } else {
        next = [...prev, { id: crypto.randomUUID(), folderId, userId, permission }];
      }
      localStorage.setItem('dms_permissions', JSON.stringify(next));
      return next;
    });
  }, []);

  const removeFolderPermission = useCallback((ruleId: string) => {
    setRules(prev => {
      const next = prev.filter(r => r.id !== ruleId);
      localStorage.setItem('dms_permissions', JSON.stringify(next));
      return next;
    });
  }, []);

  const getFolderPermission = useCallback((folderId: string, userId: string): FolderPermission => {
    const rule = rules.find(r => r.folderId === folderId && r.userId === userId);
    return rule?.permission ?? '完整權限'; // 預設完整權限
  }, [rules]);

  const getFolderRules = useCallback((folderId: string) => {
    return rules.filter(r => r.folderId === folderId);
  }, [rules]);

  return (
    <PermissionContext.Provider value={{ rules, setFolderPermission, removeFolderPermission, getFolderPermission, getFolderRules }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionProvider');
  return ctx;
};
