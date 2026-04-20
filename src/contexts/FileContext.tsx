import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { FileItem } from '@/types';
import { DEPARTMENTS, ZONES, buildDiskPath, getDepartmentSections } from '@/config/organization';
import fileService, { TrashItemDTO } from '@/services/fileService';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface FileContextType {
  files: FileItem[];
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  addFile: (file: FileItem) => void;
  uploadFile: (file: File, parentId: string | null) => Promise<FileItem | null>;
  createTextFile: (name: string, content: string, mimeType: string, parentId: string | null) => Promise<FileItem | null>;
  addFolder: (name: string, parentId: string | null) => void;
  deleteItem: (id: string) => void;
  renameItem: (id: string, newName: string) => void;
  updateFileContent: (id: string, content: string) => void;
  getChildren: (parentId: string | null) => FileItem[];
  getBreadcrumbs: (folderId: string | null) => Array<{ id: string | null; name: string }>;
  getFile: (id: string) => FileItem | undefined;
  canCreateSubfolder: (parentId: string | null) => boolean;
  getFolderLevel: (folderId: string | null) => FileItem['folderLevel'] | undefined;
  isSystemFolder: (folderId: string) => boolean;
  addSectionFolder: (department: string, section: string) => void;
  removeSectionFolder: (department: string, section: string) => void;
  trashItems: TrashItemDTO[];
  moveToTrash: (id: string, userName: string) => void;
  restoreFromTrash: (itemId: string) => void;
  permanentDelete: (itemId: string) => void;
  emptyTrash: () => void;
  loading: boolean;
  refreshFiles: () => void;
}

const FileContext = createContext<FileContextType | null>(null);

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [trashItems, setTrashItems] = useState<TrashItemDTO[]>([]);
  const [loading, setLoading] = useState(false);

  // 從後端載入檔案列表（僅登入後執行）
  const refreshFiles = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [allFiles, trash] = await Promise.all([
        fileService.getAll(),
        fileService.getTrash(),
      ]);
      setFiles(allFiles);
      setTrashItems(trash);
    } catch (err) {
      console.error('載入檔案失敗:', err);
      toast({ title: '載入失敗', description: '無法連線至伺服器', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      refreshFiles();
    } else {
      setFiles([]);
      setTrashItems([]);
    }
  }, [isAuthenticated, refreshFiles]);

  const addFile = useCallback((file: FileItem) => {
    setFiles(prev => [...prev, file]);
  }, []);

  const uploadFile = useCallback(async (file: File, parentId: string | null): Promise<FileItem | null> => {
    try {
      const created = await fileService.upload(file, parentId);
      setFiles(prev => [...prev, created]);
      return created;
    } catch (err: any) {
      console.error('上傳失敗:', err);
      const msg = err?.response?.data?.message || err?.message || '無法上傳檔案至伺服器';
      toast({ title: '上傳失敗', description: msg, variant: 'destructive' });
      return null;
    }
  }, []);

  const createTextFile = useCallback(async (
    name: string, content: string, mimeType: string, parentId: string | null
  ): Promise<FileItem | null> => {
    try {
      const blob = new Blob([content], { type: mimeType });
      const f = new File([blob], name, { type: mimeType });
      const created = await fileService.upload(f, parentId);
      setFiles(prev => [...prev, created]);
      return created;
    } catch (err: any) {
      console.error('建立文件失敗:', err);
      const msg = err?.response?.data?.message || err?.message || '無法建立文件';
      toast({ title: '建立失敗', description: msg, variant: 'destructive' });
      return null;
    }
  }, []);

  const addFolder = useCallback(async (name: string, parentId: string | null) => {
    try {
      const folder = await fileService.createFolder(name, parentId);
      setFiles(prev => [...prev, folder]);
    } catch (err) {
      console.error('建立資料夾失敗:', err);
      toast({ title: '建立失敗', variant: 'destructive' });
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await fileService.deleteItem(id);
      setFiles(prev => prev.filter(f => f.id !== id));
    } catch (err) {
      console.error('刪除失敗:', err);
      toast({ title: '刪除失敗', variant: 'destructive' });
    }
  }, []);

  const renameItem = useCallback(async (id: string, newName: string) => {
    try {
      const updated = await fileService.rename(id, newName);
      setFiles(prev => prev.map(f => f.id === id ? updated : f));
    } catch (err) {
      console.error('重新命名失敗:', err);
      toast({ title: '重新命名失敗', variant: 'destructive' });
    }
  }, []);

  const updateFileContent = useCallback(async (id: string, content: string) => {
    try {
      const updated = await fileService.updateContent(id, content);
      setFiles(prev => prev.map(f => f.id === id ? updated : f));
    } catch (err) {
      console.error('更新內容失敗:', err);
      toast({ title: '更新失敗', variant: 'destructive' });
    }
  }, []);

  const moveToTrash = useCallback(async (id: string, _userName: string) => {
    try {
      await fileService.moveToTrash(id);
      setFiles(prev => prev.filter(f => f.id !== id));
      await fileService.getTrash().then(setTrashItems);
    } catch (err) {
      console.error('移至回收桶失敗:', err);
      toast({ title: '操作失敗', variant: 'destructive' });
    }
  }, []);

  const restoreFromTrash = useCallback(async (itemId: string) => {
    try {
      await fileService.restoreFromTrash(itemId);
      await refreshFiles();
    } catch (err) {
      console.error('還原失敗:', err);
      toast({ title: '還原失敗', variant: 'destructive' });
    }
  }, [refreshFiles]);

  const permanentDelete = useCallback(async (itemId: string) => {
    try {
      await fileService.permanentDeleteTrash(itemId);
      setTrashItems(prev => prev.filter(t => t.item.id !== itemId));
    } catch (err) {
      console.error('永久刪除失敗:', err);
      toast({ title: '刪除失敗', variant: 'destructive' });
    }
  }, []);

  const emptyTrash = useCallback(async () => {
    try {
      await fileService.emptyTrash();
      setTrashItems([]);
    } catch (err) {
      console.error('清空回收桶失敗:', err);
      toast({ title: '操作失敗', variant: 'destructive' });
    }
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

  const canCreateSubfolder = useCallback((parentId: string | null): boolean => {
    if (!parentId) return false;
    const parent = files.find(f => f.id === parentId);
    if (!parent) return false;
    if (parent.folderLevel === 'zone') return false;
    if (parent.folderLevel === 'department') return false;
    if (parent.folderLevel === 'section') return true;
    if (!parent.isSystem) return true;
    return false;
  }, [files]);

  const getFolderLevel = useCallback((folderId: string | null) => {
    if (!folderId) return undefined;
    return files.find(f => f.id === folderId)?.folderLevel;
  }, [files]);

  const isSystemFolder = useCallback((folderId: string) => {
    return files.find(f => f.id === folderId)?.isSystem ?? false;
  }, [files]);

  const addSectionFolder = useCallback(async (department: string, section: string) => {
    try {
      await fileService.addSection(department, section);
      await refreshFiles();
    } catch (err) {
      console.error('新增課別失敗:', err);
      toast({ title: '新增課別失敗', variant: 'destructive' });
    }
  }, [refreshFiles]);

  const removeSectionFolder = useCallback(async (department: string, section: string) => {
    try {
      await fileService.removeSection(department, section);
      await refreshFiles();
    } catch (err) {
      console.error('刪除課別失敗:', err);
      toast({ title: '刪除課別失敗', variant: 'destructive' });
    }
  }, [refreshFiles]);

  return (
    <FileContext.Provider value={{
      files, currentFolderId, setCurrentFolderId,
      addFile, addFolder, deleteItem, renameItem,
      updateFileContent, getChildren, getBreadcrumbs, getFile,
      canCreateSubfolder, getFolderLevel, isSystemFolder,
      addSectionFolder, removeSectionFolder,
      trashItems, moveToTrash, restoreFromTrash, permanentDelete, emptyTrash,
      loading, refreshFiles,
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
