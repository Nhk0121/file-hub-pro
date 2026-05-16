import apiClient from './apiClient';

export interface OnlyOfficeConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions: Record<string, boolean>;
  };
  editorConfig: {
    mode: string;
    lang: string;
    callbackUrl: string;
    user: { id: string; name: string };
    customization: Record<string, unknown>;
  };
  documentType: 'word' | 'cell' | 'slide';
  token: string;
  documentServerUrl: string;
}

const onlyOfficeService = {
  /** 取得 OnlyOffice 編輯器設定（含 JWT） */
  getConfig: async (fileId: string): Promise<OnlyOfficeConfig> => {
    const { data } = await apiClient.get<OnlyOfficeConfig>(`/onlyoffice/config/${fileId}`);
    return data;
  },

  /** 診斷 DocServer 可達性 */
  diagnose: async (): Promise<{ ok: boolean; status?: number; body?: string; error?: string; internalUrl: string }> => {
    const { data } = await apiClient.get('/onlyoffice/diagnose');
    return data;
  },
};

export default onlyOfficeService;
