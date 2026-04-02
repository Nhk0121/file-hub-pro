import React, { createContext, useContext, useState, useCallback } from 'react';
import type { FolderPermission, FolderPermissionRule, PermanentZoneOverride } from '@/types';

interface PermissionContextType {
  rules: FolderPermissionRule[];
  setFolderPermission: (folderId: string, userId: string, permission: FolderPermission) => void;
  removeFolderPermission: (ruleId: string) => void;
  getFolderPermission: (folderId: string, userId: string) => FolderPermission;
  getFolderRules: (folderId: string) => FolderPermissionRule[];
  // 永久區跨組別權限
  permanentOverrides: PermanentZoneOverride[];
  setPermanentOverride: (userId: string, departments: string[]) => void;
  removePermanentOverride: (overrideId: string) => void;
  getUserPermanentDepts: (userId: string) => string[];
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rules, setRules] = useState<FolderPermissionRule[]>(() => {
    const saved = localStorage.getItem('dms_permissions');
    return saved ? JSON.parse(saved) : [];
  });

  const [permanentOverrides, setPermanentOverrides] = useState<PermanentZoneOverride[]>(() => {
    const saved = localStorage.getItem('dms_permanent_overrides');
    return saved ? JSON.parse(saved) : [];
  });

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
    return rule?.permission ?? '完整權限';
  }, [rules]);

  const getFolderRules = useCallback((folderId: string) => {
    return rules.filter(r => r.folderId === folderId);
  }, [rules]);

  const setPermanentOverride = useCallback((userId: string, departments: string[]) => {
    setPermanentOverrides(prev => {
      const existing = prev.findIndex(o => o.userId === userId);
      let next: PermanentZoneOverride[];
      if (existing >= 0) {
        next = prev.map((o, i) => i === existing ? { ...o, departments } : o);
      } else {
        next = [...prev, { id: crypto.randomUUID(), userId, departments }];
      }
      localStorage.setItem('dms_permanent_overrides', JSON.stringify(next));
      return next;
    });
  }, []);

  const removePermanentOverride = useCallback((overrideId: string) => {
    setPermanentOverrides(prev => {
      const next = prev.filter(o => o.id !== overrideId);
      localStorage.setItem('dms_permanent_overrides', JSON.stringify(next));
      return next;
    });
  }, []);

  const getUserPermanentDepts = useCallback((userId: string): string[] => {
    const override = permanentOverrides.find(o => o.userId === userId);
    return override?.departments ?? [];
  }, [permanentOverrides]);

  return (
    <PermissionContext.Provider value={{
      rules, setFolderPermission, removeFolderPermission, getFolderPermission, getFolderRules,
      permanentOverrides, setPermanentOverride, removePermanentOverride, getUserPermanentDepts,
    }}>
      {children}
    </PermissionContext.Provider>
  );
};

export const usePermissions = () => {
  const ctx = useContext(PermissionContext);
  if (!ctx) throw new Error('usePermissions must be used within PermissionProvider');
  return ctx;
};
