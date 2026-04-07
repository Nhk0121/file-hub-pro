import apiClient from './apiClient';

export interface DepartmentQuota {
  department: string;
  zone: string;
  quotaMB: number;
  usedMB: number;
}

const storageService = {
  /** 取得所有組別空間配額 */
  getQuotas: async (): Promise<DepartmentQuota[]> => {
    const { data } = await apiClient.get<DepartmentQuota[]>('/storage/quotas');
    return data;
  },

  /** 更新組別空間配額 */
  updateQuota: async (department: string, zone: string, quotaMB: number): Promise<void> => {
    await apiClient.put('/storage/quotas', { department, zone, quotaMB });
  },

  /** 取得磁碟總使用量 */
  getDiskUsage: async (): Promise<{ totalMB: number; usedMB: number; freeMB: number }> => {
    const { data } = await apiClient.get('/storage/disk-usage');
    return data;
  },
};

export default storageService;
