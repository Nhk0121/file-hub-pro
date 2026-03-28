export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string;
  role: '管理員' | '使用者';
}

export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  mimeType?: string;
  size?: number;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  content?: string;
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

// 資料夾權限等級
export type FolderPermission = '完整權限' | '僅下載' | '無權限';

// 資料夾權限設定
export interface FolderPermissionRule {
  id: string;
  folderId: string;
  userId: string;
  permission: FolderPermission;
}

// 稽核日誌
export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: '登入' | '登出' | '上傳' | '下載' | '刪除' | '建立資料夾' | '重新命名' | '編輯' | '權限變更';
  targetName?: string;
  targetId?: string;
  details?: string;
  ipAddress?: string;
}
