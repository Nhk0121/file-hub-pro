import apiClient from './apiClient';
import axios from 'axios';

export interface FileShare {
  token: string;
  fileId: string;
  fileName: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  revoked: boolean;
  downloadCount: number;
}

export interface PublicShareInfo {
  fileName: string;
  size: number;
  mimeType: string;
  sharedBy: string;
  sharedAt: string;
}

const shareService = {
  /** 為某個檔案建立公開分享連結 */
  create: async (fileId: string): Promise<FileShare> => {
    const { data } = await apiClient.post<FileShare>('/shares', { fileId });
    return data;
  },

  /** 取得我的分享連結（管理員可看全部） */
  list: async (): Promise<FileShare[]> => {
    const { data } = await apiClient.get<FileShare[]>('/shares');
    return Array.isArray(data) ? data : [];
  },

  /** 撤銷一個分享連結 */
  revoke: async (token: string): Promise<void> => {
    await apiClient.delete(`/shares/${token}`);
  },

  /** 取得公開分享資訊（不需登入） */
  getPublicInfo: async (token: string): Promise<PublicShareInfo> => {
    // 公開端點，使用裸 axios 避免帶上 JWT
    const baseURL = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    const { data } = await axios.get<PublicShareInfo>(`${baseURL}/shares/public/${token}`);
    return data;
  },

  /** 取得公開下載 URL */
  getPublicDownloadUrl: (token: string): string => {
    const baseURL = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
    return `${baseURL}/shares/public/${token}/download`;
  },

  /** 組裝完整可分享的網址（給使用者複製） */
  buildShareableUrl: (token: string): string => {
    return `${window.location.origin}/share/${token}`;
  },
};

export default shareService;
