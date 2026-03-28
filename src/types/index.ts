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
  content?: string; // For text/markdown/rich text documents
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}
