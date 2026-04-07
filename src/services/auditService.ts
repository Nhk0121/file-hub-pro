import apiClient from './apiClient';
import type { AuditLog } from '@/types';

const auditService = {
  /** 取得稽核日誌 */
  getAll: async (params?: { page?: number; pageSize?: number }): Promise<AuditLog[]> => {
    const { data } = await apiClient.get<AuditLog[]>('/audit', { params });
    return data;
  },

  /** 新增稽核日誌 */
  add: async (log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> => {
    await apiClient.post('/audit', log);
  },

  /** 清除稽核日誌（僅系統管理員） */
  clear: async (): Promise<void> => {
    await apiClient.delete('/audit');
  },

  /** 匯出稽核日誌 CSV */
  exportCsv: async (): Promise<Blob> => {
    const { data } = await apiClient.get('/audit/export', { responseType: 'blob' });
    return data;
  },
};

export default auditService;
