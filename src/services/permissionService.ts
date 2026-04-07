import apiClient from './apiClient';
import type { FolderPermission, FolderPermissionRule, PermanentZoneOverride } from '@/types';

const permissionService = {
  /** 取得所有資料夾權限規則 */
  getRules: async (): Promise<FolderPermissionRule[]> => {
    const { data } = await apiClient.get<FolderPermissionRule[]>('/permissions');
    return data;
  },

  /** 設定資料夾權限 */
  setFolderPermission: async (folderId: string, userId: string, permission: FolderPermission): Promise<void> => {
    await apiClient.post('/permissions', { folderId, userId, permission });
  },

  /** 移除資料夾權限 */
  removeRule: async (ruleId: string): Promise<void> => {
    await apiClient.delete(`/permissions/${ruleId}`);
  },

  /** 取得永久區跨組別權限 */
  getPermanentOverrides: async (): Promise<PermanentZoneOverride[]> => {
    const { data } = await apiClient.get<PermanentZoneOverride[]>('/permissions/permanent-overrides');
    return data;
  },

  /** 設定永久區跨組別權限 */
  setPermanentOverride: async (userId: string, departments: string[]): Promise<void> => {
    await apiClient.post('/permissions/permanent-overrides', { userId, departments });
  },

  /** 移除永久區跨組別權限 */
  removePermanentOverride: async (overrideId: string): Promise<void> => {
    await apiClient.delete(`/permissions/permanent-overrides/${overrideId}`);
  },
};

export default permissionService;
