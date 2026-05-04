import apiClient from './apiClient';

export interface OnlyOfficeConfig {
  document: {
    fileType: string;
    key: string;
    title: string;
    url: string;
    permissions: { edit: boolean; download: boolean; print: boolean };
  };
  documentType: 'word' | 'cell' | 'slide';
  editorConfig: {
    mode: 'edit' | 'view';
    lang: string;
    callbackUrl: string;
    user: { id: string; name: string };
    customization: Record<string, unknown>;
  };
  type: string;
  documentServerUrl: string;
  lockedBy?: string | null;
  token: string;
}

const OFFICE_EXTS = new Set([
  'doc', 'docx', 'odt', 'rtf',
  'xls', 'xlsx', 'ods', 'csv',
  'ppt', 'pptx', 'odp',
]);

const onlyOfficeService = {
  /** 取得 OnlyOffice 編輯器 config（含 JWT、callback、編輯鎖狀態） */
  getConfig: async (fileId: string): Promise<OnlyOfficeConfig> => {
    const { data } = await apiClient.get<OnlyOfficeConfig>(`/onlyoffice/config/${fileId}`);
    return data;
  },

  /** 判斷副檔名是否為 OnlyOffice 可開啟之 Office 文件 */
  isOfficeFile: (fileName: string): boolean => {
    const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
    return OFFICE_EXTS.has(ext);
  },
};

export default onlyOfficeService;
