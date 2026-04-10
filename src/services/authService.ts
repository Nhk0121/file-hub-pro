import apiClient from './apiClient';
import type { User } from '@/types';

export interface LoginResponse {
  token: string;
  user: User;
}

const authService = {
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    localStorage.setItem('dms_token', data.token);
    return data;
  },

  logout: async (): Promise<void> => {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('dms_token');
    localStorage.removeItem('dms_user');
  },

  getProfile: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/profile');
    return data;
  },

  updateProfile: async (updates: Partial<User>): Promise<User> => {
    const { data } = await apiClient.put<User>('/auth/profile', updates);
    return data;
  },

  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/change-password', { oldPassword, newPassword });
  },
};

export default authService;
