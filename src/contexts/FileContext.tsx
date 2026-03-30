import React, { createContext, useContext, useState, useCallback } from 'react';
import type { FileItem } from '@/types';
import { DEPARTMENTS, DEPARTMENT_SECTIONS, ZONES, buildDiskPath } from '@/config/organization';

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
  canCreateSubfolder: (parentId: string | null) => boolean;
  getFolderLevel: (folderId: string | null) => FileItem['folderLevel'] | undefined;
  isSystemFolder: (folderId: string) => boolean;
}

const FileContext = createContext<FileContextType | null>(null);

// 建立系統初始資料夾結構
function buildInitialFolders(): FileItem[] {
  const folders: FileItem[] = [];
  const now = new Date().toISOString();

  ZONES.forEach(zone => {
    const zoneId = `zone_${zone}`;
    folders.push({
      id: zoneId,
      name: zone,
      type: 'folder',
      parentId: null,
      createdAt: now,
      updatedAt: now,
      createdBy: '系統',
      isSystem: true,
      folderLevel: 'zone',
      diskPath: buildDiskPath(zone),
    });

    DEPARTMENTS.forEach(dept => {
      const deptId = `dept_${zone}_${dept}`;
      folders.push({
        id: deptId,
        name: dept,
        type: 'folder',
        parentId: zoneId,
        createdAt: now,
        updatedAt: now,
        createdBy: '系統',
        isSystem: true,
        folderLevel: 'department',
        diskPath: buildDiskPath(zone, dept),
      });

      const sections = DEPARTMENT_SECTIONS[dept] ?? [];
      sections.forEach(sec => {
        const secId = `sec_${zone}_${dept}_${sec}`;
        folders.push({
          id: secId,
          name: sec,
          type: 'folder',
          parentId: deptId,
          createdAt: now,
          updatedAt: now,
          createdBy: '系統',
          isSystem: true,
          folderLevel: 'section',
          diskPath: buildDiskPath(zone, dept, sec),
        });
      });
    });
  });

  return folders;
}

const INITIAL_FILES = buildInitialFolders();

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>(() => {
    const saved = localStorage.getItem('dms_files_v2');
    if (saved) {
      const parsed = JSON.parse(saved) as FileItem[];
      // 確保系統資料夾都存在
      const existingIds = new Set(parsed.map(f => f.id));
      const missing = INITIAL_FILES.filter(f => !existingIds.has(f.id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        localStorage.setItem('dms_files_v2', JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
    localStorage.setItem('dms_files_v2', JSON.stringify(INITIAL_FILES));
    return INITIAL_FILES;
  });
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  const persist = (next: FileItem[]) => {
    setFiles(next);
    localStorage.setItem('dms_files_v2', JSON.stringify(next));
  };

  const addFile = useCallback((file: FileItem) => {
    setFiles(prev => {
      const next = [...prev, file];
      localStorage.setItem('dms_files_v2', JSON.stringify(next));
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
      localStorage.setItem('dms_files_v2', JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteItem = useCallback((id: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.isSystem) return prev; // 系統資料夾不可刪除
      const toDelete = new Set<string>();
      const collect = (targetId: string) => {
        toDelete.add(targetId);
        prev.filter(f => f.parentId === targetId).forEach(f => collect(f.id));
      };
      collect(id);
      const next = prev.filter(f => !toDelete.has(f.id));
      localStorage.setItem('dms_files_v2', JSON.stringify(next));
      return next;
    });
  }, []);

  const renameItem = useCallback((id: string, newName: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.isSystem) return prev; // 系統資料夾不可重命名
      const next = prev.map(f => f.id === id ? { ...f, name: newName, updatedAt: new Date().toISOString() } : f);
      localStorage.setItem('dms_files_v2', JSON.stringify(next));
      return next;
    });
  }, []);

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles(prev => {
      const next = prev.map(f => f.id === id ? { ...f, content, updatedAt: new Date().toISOString() } : f);
      localStorage.setItem('dms_files_v2', JSON.stringify(next));
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

  // 判斷是否可以在指定資料夾下建立子資料夾
  // 規則：組別資料夾下不可自行建立課別資料夾（課別由系統管理）
  const canCreateSubfolder = useCallback((parentId: string | null): boolean => {
    if (!parentId) return false; // 根目錄不允許（已有時效區/永久區）
    const parent = files.find(f => f.id === parentId);
    if (!parent) return false;
    // zone 下不可建立（已有組別）
    if (parent.folderLevel === 'zone') return false;
    // department 下不可建立（課別由系統管理）
    if (parent.folderLevel === 'department') return false;
    // section 下可以建立自訂子資料夾
    if (parent.folderLevel === 'section') return true;
    // 非系統資料夾可以建立
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

  return (
    <FileContext.Provider value={{
      files, currentFolderId, setCurrentFolderId,
      addFile, addFolder, deleteItem, renameItem,
      updateFileContent, getChildren, getBreadcrumbs, getFile,
      canCreateSubfolder, getFolderLevel, isSystemFolder,
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
