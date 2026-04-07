import apiClient from './apiClient';
import type { User, UserRole, UserRegistration } from '@/types';

const userService = {
  /** 取得所有使用者 */
  getAll: async (): Promise<User[]> => {
    const { data } = await apiClient.get<User[]>('/users');
    return data;
  },

  /** 新增使用者 */
  create: async (user: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const { data } = await apiClient.post<User>('/users', user);
    return data;
  },

  /** 更新使用者 */
  update: async (userId: string, updates: Partial<User>): Promise<User> => {
    const { data } = await apiClient.put<User>(`/users/${userId}`, updates);
    return data;
  },

  /** 刪除使用者 */
  remove: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`);
  },

  /** 更新角色 */
  updateRole: async (userId: string, role: UserRole): Promise<void> => {
    await apiClient.put(`/users/${userId}/role`, { role });
  },

  /** 重置密碼 */
  resetPassword: async (userId: string): Promise<void> => {
    await apiClient.post(`/users/${userId}/reset-password`);
  },

  /** 取得帳號申請列表 */
  getRegistrations: async (): Promise<UserRegistration[]> => {
    const { data } = await apiClient.get<UserRegistration[]>('/registrations');
    return data;
  },

  /** 提交帳號申請 */
  submitRegistration: async (reg: Omit<UserRegistration, 'id' | 'status' | 'createdAt'>): Promise<void> => {
    await apiClient.post('/registrations', reg);
  },

  /** 審核帳號申請 */
  reviewRegistration: async (
    regId: string,
    status: '已核准' | '已拒絕',
    reviewerName: string,
    rejectReason?: string
  ): Promise<void> => {
    await apiClient.put(`/registrations/${regId}/review`, { status, reviewerName, rejectReason });
  },
};

export default userService;
