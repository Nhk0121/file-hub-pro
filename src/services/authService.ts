import apiClient from './apiClient';
import type { User, UserRole, UserRegistration, ApplicantType } from '@/types';

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegistrationPayload {
  applicantType: ApplicantType;
  username: string;
  password: string;
  displayName: string;
  email: string;
  department?: string;
  section?: string;
  jobTitle?: string;
  phone?: string;
  extension?: string;
}

const authService = {
  /** 登入 */
  login: async (username: string, password: string): Promise<LoginResponse> => {
    const { data } = await apiClient.post<LoginResponse>('/auth/login', { username, password });
    localStorage.setItem('dms_token', data.token);
    return data;
  },

  /** 登出 */
  logout: async (): Promise<void> => {
    try { await apiClient.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('dms_token');
    localStorage.removeItem('dms_user');
  },

  /** 取得目前使用者資訊 */
  getProfile: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/auth/profile');
    return data;
  },

  /** 更新個人資料 */
  updateProfile: async (updates: Partial<User>): Promise<User> => {
    const { data } = await apiClient.put<User>('/auth/profile', updates);
    return data;
  },

  /** 變更密碼 */
  changePassword: async (oldPassword: string, newPassword: string): Promise<void> => {
    await apiClient.put('/auth/password', { oldPassword, newPassword });
  },
};

export default authService;
