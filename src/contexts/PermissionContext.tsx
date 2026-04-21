import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { FolderPermission, FolderPermissionRule, PermanentZoneOverride } from '@/types';
import permissionService from '@/services/permissionService';
import { useAuth } from '@/contexts/AuthContext';

interface PermissionContextType {
  rules: FolderPermissionRule[];
  setFolderPermission: (folderId: string, userId: string, permission: FolderPermission) => Promise<void>;
  removeFolderPermission: (ruleId: string) => Promise<void>;
  getFolderPermission: (folderId: string, userId: string) => FolderPermission;
  getFolderRules: (folderId: string) => FolderPermissionRule[];
  permanentOverrides: PermanentZoneOverride[];
  setPermanentOverride: (userId: string, departments: string[]) => Promise<void>;
  removePermanentOverride: (overrideId: string) => Promise<void>;
  getUserPermanentDepts: (userId: string) => string[];
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [rules, setRules] = useState<FolderPermissionRule[]>([]);
  const [permanentOverrides, setPermanentOverrides] = useState<PermanentZoneOverride[]>([]);

  const refreshPermissions = useCallback(async () => {
    if (!isAuthenticated) return;
    const [nextRules, nextOverrides] = await Promise.all([
      permissionService.getRules(),
      permissionService.getPermanentOverrides(),
    ]);
    setRules(Array.isArray(nextRules) ? nextRules : []);
    setPermanentOverrides(Array.isArray(nextOverrides) ? nextOverrides : []);
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) refreshPermissions();
    else {
      setRules([]);
      setPermanentOverrides([]);
    }
  }, [isAuthenticated, refreshPermissions]);

  const setFolderPermission = useCallback(async (folderId: string, userId: string, permission: FolderPermission) => {
    await permissionService.setFolderPermission(folderId, userId, permission);
    await refreshPermissions();
  }, [refreshPermissions]);

  const removeFolderPermission = useCallback(async (ruleId: string) => {
    await permissionService.removeRule(ruleId);
    await refreshPermissions();
  }, [refreshPermissions]);

  const setPermanentOverride = useCallback(async (userId: string, departments: string[]) => {
    await permissionService.setPermanentOverride(userId, departments);
    await refreshPermissions();
  }, [refreshPermissions]);

  const removePermanentOverride = useCallback(async (overrideId: string) => {
    await permissionService.removePermanentOverride(overrideId);
    await refreshPermissions();
  }, [refreshPermissions]);

  const getFolderPermission = useCallback((folderId: string, userId: string): FolderPermission => {
    const rule = rules.find(r => r.folderId === folderId && r.userId === userId);
    return rule?.permission ?? '完整權限';
  }, [rules]);

  const getFolderRules = useCallback((folderId: string) => {
    return rules.filter(r => r.folderId === folderId);
  }, [rules]);

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
