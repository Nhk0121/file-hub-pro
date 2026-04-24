import apiClient from './apiClient';
import type { FileItem } from '@/types';

export interface TrashItemDTO {
  item: FileItem;
  deletedAt: string;
  deletedBy: string;
  originalParentId: string | null;
}

export interface SystemFolderStatus {
  lastEnsuredAt: string | null;
  cachedSectionCount: number | null;
  currentSectionCount: number;
  totalSystemFolders: number;
  expectedSystemFolders: number;
  isHealthy: boolean;
  lastError: string | null;
  lastDurationMs: number;
  basePath: string;
}

const fileService = {
  /** 取得所有檔案與資料夾 */
  getAll: async (): Promise<FileItem[]> => {
    const { data } = await apiClient.get<FileItem[]>('/files');
    return Array.isArray(data) ? data : [];
  },

  /** 取得特定資料夾下的子項目 */
  getChildren: async (parentId: string | null): Promise<FileItem[]> => {
    const { data } = await apiClient.get<FileItem[]>('/files', {
      params: { parentId: parentId ?? '' },
    });
    return Array.isArray(data) ? data : [];
  },

  /** 取得單一檔案資訊 */
  getById: async (id: string): Promise<FileItem> => {
    const { data } = await apiClient.get<FileItem>(`/files/${id}`);
    return data;
  },

  /** 建立資料夾 */
  createFolder: async (name: string, parentId: string | null): Promise<FileItem> => {
    const { data } = await apiClient.post<FileItem>('/files/folder', { name, parentId });
    return data;
  },

  /** 上傳檔案 */
  upload: async (file: File, parentId: string | null): Promise<FileItem> => {
    const formData = new FormData();
    formData.append('file', file);
    if (parentId) formData.append('parentId', parentId);
    const { data } = await apiClient.post<FileItem>('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return data;
  },

  /** 刪除檔案/資料夾（移至回收桶） */
  moveToTrash: async (id: string): Promise<void> => {
    await apiClient.post(`/files/${id}/trash`);
  },

  /** 永久刪除 */
  deleteItem: async (id: string): Promise<void> => {
    await apiClient.delete(`/files/${id}`);
  },

  /** 系統管理員強制刪除（含實體與子內容，用於清除重複系統資料夾） */
  forceDelete: async (id: string): Promise<void> => {
    await apiClient.delete(`/files/${id}/force`);
  },

  /** 重新命名 */
  rename: async (id: string, newName: string): Promise<FileItem> => {
    const { data } = await apiClient.put<FileItem>(`/files/${id}/rename`, { name: newName });
    return data;
  },

  /** 更新檔案內容 */
  updateContent: async (id: string, content: string): Promise<FileItem> => {
    const { data } = await apiClient.put<FileItem>(`/files/${id}/content`, { content });
    return data;
  },

  /** 下載檔案 */
  download: async (id: string): Promise<Blob> => {
    const { data } = await apiClient.get(`/files/${id}/download`, { responseType: 'blob' });
    return data;
  },

  // === 回收桶 ===
  /** 取得回收桶項目 */
  getTrash: async (): Promise<TrashItemDTO[]> => {
    const { data } = await apiClient.get<TrashItemDTO[]>('/trash');
    return Array.isArray(data) ? data : [];
  },

  /** 還原回收桶項目 */
  restoreFromTrash: async (itemId: string): Promise<void> => {
    await apiClient.post(`/trash/${itemId}/restore`);
  },

  /** 永久刪除回收桶項目 */
  permanentDeleteTrash: async (itemId: string): Promise<void> => {
    await apiClient.delete(`/trash/${itemId}`);
  },

  /** 清空回收桶 */
  emptyTrash: async (): Promise<void> => {
    await apiClient.delete('/trash');
  },

  // === 課別管理 ===
  /** 取得所有課別 (依組別分組) */
  getSections: async (): Promise<Record<string, string[]>> => {
    const { data } = await apiClient.get<Record<string, string[]>>('/files/sections');
    return data ?? {};
  },

  /** 新增課別資料夾 */
  addSection: async (department: string, section: string): Promise<void> => {
    await apiClient.post('/files/sections', { department, section });
  },

  /** 刪除課別資料夾 */
  removeSection: async (department: string, section: string): Promise<void> => {
    await apiClient.delete('/files/sections', { data: { department, section } });
  },

  // === 系統資料夾狀態 ===
  /** 取得系統資料夾初始化狀態 */
  getSystemStatus: async (): Promise<SystemFolderStatus> => {
    const { data } = await apiClient.get<SystemFolderStatus>('/files/system-status');
    return data;
  },

  /** 手動強制重新初始化系統資料夾 */
  reinitSystemFolders: async (): Promise<SystemFolderStatus> => {
    const { data } = await apiClient.post<SystemFolderStatus>('/files/system-reinit');
    return data;
  },
};

export default fileService;
