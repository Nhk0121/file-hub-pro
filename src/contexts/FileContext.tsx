import React, { createContext, useContext, useState, useCallback } from 'react';
import type { FileItem } from '@/types';

interface FileContextType {
  files: FileItem[];
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  addFile: (file: FileItem) => void;
  addFolder: (name: string, parentId: string | null) => void;
  deleteItem: (id: string) => void;
  renameItem: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  getChildren: (parentId: string | null) => FileItem[];
  getBreadcrumbs: (folderId: string | null) => Array<{ id: string | null; name: string }>;
  getFile: (id: string) => FileItem | undefined;
}

const FileContext = createContext<FileContextType | null>(null);

const initialFiles: FileItem[] = [
  {
    id: 'f1',
    name: '公司文件',
    type: 'folder',
    parentId: null,
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-01-15T08:00:00Z',
    createdBy: '系統管理員',
  },
  {
    id: 'f2',
    name: '專案資料',
    type: 'folder',
    parentId: null,
    createdAt: '2024-01-16T09:00:00Z',
    updatedAt: '2024-01-16T09:00:00Z',
    createdBy: '系統管理員',
  },
  {
    id: 'f3',
    name: '會議記錄',
    type: 'folder',
    parentId: 'f1',
    createdAt: '2024-01-17T10:00:00Z',
    updatedAt: '2024-01-17T10:00:00Z',
    createdBy: '系統管理員',
  },
  {
    id: 'd1',
    name: '歡迎使用文件管理系統.md',
    type: 'file',
    mimeType: 'text/markdown',
    size: 1024,
    parentId: null,
    createdAt: '2024-01-15T08:30:00Z',
    updatedAt: '2024-01-15T08:30:00Z',
    createdBy: '系統管理員',
    content: '# 歡迎使用文件管理系統\n\n這是一個功能完整的文件管理系統，支援：\n\n- 📁 資料夾管理\n- 📄 檔案上傳與下載\n- ✏️ 線上文件編輯（Markdown 與富文字）\n- 🔍 檔案搜尋\n\n## 快速開始\n\n1. 建立新資料夾來組織您的檔案\n2. 上傳檔案或建立新文件\n3. 雙擊文件即可開始編輯\n',
  },
  {
    id: 'd2',
    name: '2024年第一季報告.html',
    type: 'file',
    mimeType: 'text/html',
    size: 2048,
    parentId: 'f1',
    createdAt: '2024-02-01T14:00:00Z',
    updatedAt: '2024-02-15T16:30:00Z',
    createdBy: '一般使用者',
    content: '<h2>2024年第一季報告</h2><p>本季度業績表現優異，以下為重點摘要：</p><ul><li>營收成長 <strong>15%</strong></li><li>新客戶增加 <strong>200</strong> 家</li><li>客戶滿意度達 <strong>92%</strong></li></ul><p>詳細內容請參閱附件。</p>',
  },
];

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>(() => {
    const saved = localStorage.getItem('dms_files');
    return saved ? JSON.parse(saved) : initialFiles;
  });
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const save = (newFiles: FileItem[]) => {
    setFiles(newFiles);
    localStorage.setItem('dms_files', JSON.stringify(newFiles));
  };

  const addFile = useCallback((file: FileItem) => {
    setFiles(prev => {
      const next = [...prev, file];
      localStorage.setItem('dms_files', JSON.stringify(next));
      return next;
    });
  }, []);

  const addFolder = useCallback((name: string, parentId: string | null) => {
    const folder: FileItem = {
      id: crypto.randomUUID(),
      name,
      type: 'folder',
      parentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: '目前使用者',
    };
    setFiles(prev => {
      const next = [...prev, folder];
      localStorage.setItem('dms_files', JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setFiles(prev => {
      // Recursively delete children
      const toDelete = new Set<string>();
      const collect = (targetId: string) => {
        toDelete.add(targetId);
        prev.filter(f => f.parentId === targetId).forEach(f => collect(f.id));
      };
      collect(id);
      const next = prev.filter(f => !toDelete.has(f.id));
      localStorage.setItem('dms_files', JSON.stringify(next));
      return next;
    });
  }, []);

  const renameItem = useCallback((id: string, newName: string) => {
    setFiles(prev => {
      const next = prev.map(f => f.id === id ? { ...f, name: newName, updatedAt: new Date().toISOString() } : f);
      localStorage.setItem('dms_files', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles(prev => {
      const next = prev.map(f => f.id === id ? { ...f, content, updatedAt: new Date().toISOString() } : f);
      localStorage.setItem('dms_files', JSON.stringify(next));
      return next;
    });
  }, []);

  const getChildren = useCallback((parentId: string | null) => {
    return files.filter(f => f.parentId === parentId);
  }, [files]);

  const getBreadcrumbs = useCallback((folderId: string | null) => {
    const crumbs: Array<{ id: string | null; name: string }> = [{ id: null, name: '根目錄' }];
    let current = folderId;
    const chain: Array<{ id: string | null; name: string }> = [];
    while (current) {
      const folder = files.find(f => f.id === current);
      if (folder) {
        chain.unshift({ id: folder.id, name: folder.name });
        current = folder.parentId;
      } else break;
    }
    return [...crumbs, ...chain];
  }, [files]);

  const getFile = useCallback((id: string) => files.find(f => f.id === id), [files]);

  return (
    <FileContext.Provider value={{
      files, currentFolderId, setCurrentFolderId,
      addFile, addFolder, deleteItem, renameItem,
      updateFileContent, getChildren, getBreadcrumbs, getFile,
    }}>
      {children}
    </FileContext.Provider>
  );
};

export const useFiles = () => {
  const ctx = useContext(FileContext);
  if (!ctx) throw new Error('useFiles must be used within FileProvider');
  return ctx;
};
