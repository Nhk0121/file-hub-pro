import apiClient from './apiClient';
import type { User, UserRole, UserRegistration } from '@/types';

const userService = {
  getAll: async (): Promise<User[]> => {
    const { data } = await apiClient.get<User[]>('/users');
    return data;
  },

  create: async (userData: Omit<User, 'id'> & { password: string }): Promise<User> => {
    const { data } = await apiClient.post<User>('/users', userData);
    return data;
  },

  update: async (userId: string, updates: Partial<User>): Promise<User> => {
    const { data } = await apiClient.put<User>(`/users/${userId}`, updates);
    return data;
  },

  remove: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`);
  },

  updateRole: async (userId: string, role: UserRole): Promise<void> => {
    await apiClient.put(`/users/${userId}/role`, { role });
  },

  resetPassword: async (userId: string): Promise<void> => {
    await apiClient.post(`/users/${userId}/reset-password`);
  },

  getRegistrations: async (): Promise<UserRegistration[]> => {
    const { data } = await apiClient.get<UserRegistration[]>('/users/registrations');
    return data;
  },

  submitRegistration: async (reg: Omit<UserRegistration, 'id' | 'status' | 'createdAt'>): Promise<void> => {
    await apiClient.post('/users/registrations', reg);
  },

  reviewRegistration: async (
    regId: string,
    status: '已核准' | '已拒絕',
    reviewerName: string,
    rejectReason?: string
  ): Promise<void> => {
    await apiClient.post(`/users/registrations/${regId}/review`, {
      status, reviewerName, rejectReason
    });
  },
};

export default userService;
