import apiClient from './apiClient';

export interface DepartmentQuota {
  department: string;
  zone: string;
  quotaMB: number;
  usedMB: number;
}

export interface StorageSettings {
  primaryPath: string;
  autoCreateFolders: boolean;
  backupEnabled: boolean;
  backupFrequency: '每日' | '每週' | '每月' | '手動';
  backupTime: string;
  backupRetentionDays: number;
  trashRetentionDays: number;
  tempZoneRetentionDays: number;
  updatedAt: string;
}

export interface BackupDisk {
  id: string;
  label: string;
  path: string;
  enabled: boolean;
  createdAt: string;
  lastSyncAt?: string | null;
}

export interface DiskUsage {
  totalMB: number;
  usedMB: number;
  freeMB: number;
}

export interface InitializeFoldersResult {
  created: number;
  skipped: number;
  paths: string[];
  errors: string[];
}

const storageService = {
  // 配額
  getQuotas: async (): Promise<DepartmentQuota[]> => {
    const { data } = await apiClient.get<DepartmentQuota[]>('/storage/quotas');
    return Array.isArray(data) ? data : [];
  },
  updateQuota: async (department: string, zone: string, quotaMB: number): Promise<void> => {
    await apiClient.put('/storage/quotas', { department, zone, quotaMB });
  },

  // 磁碟使用量
  getDiskUsage: async (): Promise<DiskUsage> => {
    const { data } = await apiClient.get<DiskUsage>('/storage/disk-usage');
    return data ?? { totalMB: 0, usedMB: 0, freeMB: 0 };
  },

  // 系統設定
  getSettings: async (): Promise<StorageSettings> => {
    const { data } = await apiClient.get<StorageSettings>('/storage/settings');
    return data;
  },
  updateSettings: async (settings: Omit<StorageSettings, 'updatedAt'>): Promise<void> => {
    await apiClient.put('/storage/settings', settings);
  },

  // 備份磁碟
  getDisks: async (): Promise<BackupDisk[]> => {
    const { data } = await apiClient.get<BackupDisk[]>('/storage/disks');
    return Array.isArray(data) ? data : [];
  },
  addDisk: async (label: string, path: string): Promise<BackupDisk> => {
    const { data } = await apiClient.post<BackupDisk>('/storage/disks', { label, path });
    return data;
  },
  updateDisk: async (id: string, updates: Partial<Pick<BackupDisk, 'label' | 'path' | 'enabled'>>): Promise<void> => {
    await apiClient.put(`/storage/disks/${id}`, updates);
  },
  removeDisk: async (id: string): Promise<void> => {
    await apiClient.delete(`/storage/disks/${id}`);
  },

  // 移機：自動建立資料夾
  initializeFolders: async (): Promise<InitializeFoldersResult> => {
    const { data } = await apiClient.post<InitializeFoldersResult>('/storage/initialize-folders');
    return data;
  },
};

export default storageService;
