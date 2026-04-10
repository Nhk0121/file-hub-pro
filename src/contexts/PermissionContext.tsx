import React, { createContext, useContext, useState, useCallback } from 'react';
import type { FolderPermission, FolderPermissionRule, PermanentZoneOverride } from '@/types';

const RULES_KEY = 'dms_permission_rules';
const OVERRIDES_KEY = 'dms_permanent_overrides';

function loadRules(): FolderPermissionRule[] {
  const saved = localStorage.getItem(RULES_KEY);
  return saved ? JSON.parse(saved) : [];
}
function saveRules(rules: FolderPermissionRule[]) {
  localStorage.setItem(RULES_KEY, JSON.stringify(rules));
}
function loadOverrides(): PermanentZoneOverride[] {
  const saved = localStorage.getItem(OVERRIDES_KEY);
  return saved ? JSON.parse(saved) : [];
}
function saveOverrides(overrides: PermanentZoneOverride[]) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

interface PermissionContextType {
  rules: FolderPermissionRule[];
  setFolderPermission: (folderId: string, userId: string, permission: FolderPermission) => void;
  removeFolderPermission: (ruleId: string) => void;
  getFolderPermission: (folderId: string, userId: string) => FolderPermission;
  getFolderRules: (folderId: string) => FolderPermissionRule[];
  permanentOverrides: PermanentZoneOverride[];
  setPermanentOverride: (userId: string, departments: string[]) => void;
  removePermanentOverride: (overrideId: string) => void;
  getUserPermanentDepts: (userId: string) => string[];
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rules, setRules] = useState<FolderPermissionRule[]>(() => loadRules());
  const [permanentOverrides, setPermanentOverrides] = useState<PermanentZoneOverride[]>(() => loadOverrides());

  const setFolderPermission = useCallback((folderId: string, userId: string, permission: FolderPermission) => {
    setRules(prev => {
      const existing = prev.findIndex(r => r.folderId === folderId && r.userId === userId);
      let updated: FolderPermissionRule[];
      if (existing >= 0) {
        updated = prev.map((r, i) => i === existing ? { ...r, permission } : r);
      } else {
        updated = [...prev, { id: crypto.randomUUID(), folderId, userId, permission }];
      }
      saveRules(updated);
      return updated;
    });
  }, []);

  const removeFolderPermission = useCallback((ruleId: string) => {
    setRules(prev => {
      const updated = prev.filter(r => r.id !== ruleId);
      saveRules(updated);
      return updated;
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
      let updated: PermanentZoneOverride[];
      if (existing >= 0) {
        updated = prev.map((o, i) => i === existing ? { ...o, departments } : o);
      } else {
        updated = [...prev, { id: crypto.randomUUID(), userId, departments }];
      }
      saveOverrides(updated);
      return updated;
    });
  }, []);

  const removePermanentOverride = useCallback((overrideId: string) => {
    setPermanentOverrides(prev => {
      const updated = prev.filter(o => o.id !== overrideId);
      saveOverrides(updated);
      return updated;
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
