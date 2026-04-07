import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { FileItem } from '@/types';
import { DEPARTMENTS, ZONES, buildDiskPath, getDepartmentSections } from '@/config/organization';
import fileService, { type TrashItemDTO } from '@/services/fileService';

interface FileContextType {
  files: FileItem[];
  currentFolderId: string | null;
  setCurrentFolderId: (id: string | null) => void;
  addFile: (file: FileItem) => Promise<void>;
  addFolder: (name: string, parentId: string | null) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  renameItem: (id: string, newName: string) => Promise<void>;
  updateFileContent: (id: string, content: string) => Promise<void>;
  getChildren: (parentId: string | null) => FileItem[];
  getBreadcrumbs: (folderId: string | null) => Array<{ id: string | null; name: string }>;
  getFile: (id: string) => FileItem | undefined;
  canCreateSubfolder: (parentId: string | null) => boolean;
  getFolderLevel: (folderId: string | null) => FileItem['folderLevel'] | undefined;
  isSystemFolder: (folderId: string) => boolean;
  addSectionFolder: (department: string, section: string) => Promise<void>;
  removeSectionFolder: (department: string, section: string) => Promise<void>;
  trashItems: TrashItemDTO[];
  moveToTrash: (id: string, userName: string) => Promise<void>;
  restoreFromTrash: (itemId: string) => Promise<void>;
  permanentDelete: (itemId: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  loading: boolean;
  refreshFiles: () => Promise<void>;
}

const FileContext = createContext<FileContextType | null>(null);

// 建立系統初始資料夾結構（作為 fallback）
function buildInitialFolders(): FileItem[] {
  const folders: FileItem[] = [];
  const now = new Date().toISOString();

  ZONES.forEach(zone => {
    const zoneId = `zone_${zone}`;
    folders.push({
      id: zoneId, name: zone, type: 'folder', parentId: null,
      createdAt: now, updatedAt: now, createdBy: '系統',
      isSystem: true, folderLevel: 'zone', diskPath: buildDiskPath(zone),
    });

    DEPARTMENTS.forEach(dept => {
      const deptId = `dept_${zone}_${dept}`;
      folders.push({
        id: deptId, name: dept, type: 'folder', parentId: zoneId,
        createdAt: now, updatedAt: now, createdBy: '系統',
        isSystem: true, folderLevel: 'department', diskPath: buildDiskPath(zone, dept),
      });

      const sections = getDepartmentSections()[dept] ?? [];
      sections.forEach(sec => {
        folders.push({
          id: `sec_${zone}_${dept}_${sec}`, name: sec, type: 'folder', parentId: deptId,
          createdAt: now, updatedAt: now, createdBy: '系統',
          isSystem: true, folderLevel: 'section', diskPath: buildDiskPath(zone, dept, sec),
        });
      });
    });
  });

  return folders;
}

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>(() => buildInitialFolders());
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [trashItems, setTrashItems] = useState<TrashItemDTO[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshFiles = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fileService.getAll();
      setFiles(data.length > 0 ? data : buildInitialFolders());
    } catch (err) {
      console.error('Failed to load files:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshTrash = useCallback(async () => {
    try {
      const data = await fileService.getTrash();
      setTrashItems(data);
    } catch (err) {
      console.error('Failed to load trash:', err);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    const token = localStorage.getItem('dms_token');
    if (token) {
      refreshFiles();
      refreshTrash();
    }
  }, [refreshFiles, refreshTrash]);

  const addFile = useCallback(async (file: FileItem) => {
    // 樂觀更新
    setFiles(prev => [...prev, file]);
    // 如果有實際檔案上傳，呼叫端應改用 fileService.upload
  }, []);

  const addFolder = useCallback(async (name: string, parentId: string | null) => {
    try {
      const folder = await fileService.createFolder(name, parentId);
      setFiles(prev => [...prev, folder]);
    } catch (err) {
      console.error('Failed to create folder:', err);
      throw err;
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const target = files.find(f => f.id === id);
    if (target?.isSystem) return;
    try {
      await fileService.deleteItem(id);
      await refreshFiles();
    } catch (err) {
      console.error('Failed to delete item:', err);
      throw err;
    }
  }, [files, refreshFiles]);

  const renameItem = useCallback(async (id: string, newName: string) => {
    const target = files.find(f => f.id === id);
    if (target?.isSystem) return;
    try {
      const updated = await fileService.rename(id, newName);
      setFiles(prev => prev.map(f => f.id === id ? updated : f));
    } catch (err) {
      console.error('Failed to rename:', err);
      throw err;
    }
  }, [files]);

  const updateFileContent = useCallback(async (id: string, content: string) => {
    try {
      const updated = await fileService.updateContent(id, content);
      setFiles(prev => prev.map(f => f.id === id ? updated : f));
    } catch (err) {
      console.error('Failed to update content:', err);
      throw err;
    }
  }, []);

  const moveToTrash = useCallback(async (id: string, _userName: string) => {
    const target = files.find(f => f.id === id);
    if (!target || target.isSystem) return;
    try {
      await fileService.moveToTrash(id);
      await Promise.all([refreshFiles(), refreshTrash()]);
    } catch (err) {
      console.error('Failed to move to trash:', err);
      throw err;
    }
  }, [files, refreshFiles, refreshTrash]);

  const restoreFromTrash = useCallback(async (itemId: string) => {
    try {
      await fileService.restoreFromTrash(itemId);
      await Promise.all([refreshFiles(), refreshTrash()]);
    } catch (err) {
      console.error('Failed to restore:', err);
      throw err;
    }
  }, [refreshFiles, refreshTrash]);

  const permanentDelete = useCallback(async (itemId: string) => {
    try {
      await fileService.permanentDeleteTrash(itemId);
      await refreshTrash();
    } catch (err) {
      console.error('Failed to permanent delete:', err);
      throw err;
    }
  }, [refreshTrash]);

  const emptyTrash = useCallback(async () => {
    try {
      await fileService.emptyTrash();
      setTrashItems([]);
    } catch (err) {
      console.error('Failed to empty trash:', err);
      throw err;
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
      console.error('Failed to add section:', err);
      throw err;
    }
  }, [refreshFiles]);

  const removeSectionFolder = useCallback(async (department: string, section: string) => {
    try {
      await fileService.removeSection(department, section);
      await refreshFiles();
    } catch (err) {
      console.error('Failed to remove section:', err);
      throw err;
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
