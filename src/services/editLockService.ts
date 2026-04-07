import apiClient from './apiClient';

export interface EditLockDTO {
  fileId: string;
  userId: string;
  userName: string;
  lockedAt: string;
}

const editLockService = {
  /** 取得所有編輯鎖定 */
  getAll: async (): Promise<EditLockDTO[]> => {
    const { data } = await apiClient.get<EditLockDTO[]>('/edit-locks');
    return data;
  },

  /** 取得或鎖定檔案 */
  acquire: async (fileId: string): Promise<{ success: boolean; lock?: EditLockDTO }> => {
    const { data } = await apiClient.post(`/edit-locks/${fileId}`);
    return data;
  },

  /** 釋放鎖定 */
  release: async (fileId: string): Promise<void> => {
    await apiClient.delete(`/edit-locks/${fileId}`);
  },
};

export default editLockService;
