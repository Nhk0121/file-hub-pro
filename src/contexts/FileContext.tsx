import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { FileItem } from '@/types';
import { DEPARTMENTS, ZONES, buildDiskPath, getDepartmentSections } from '@/config/organization';

const FILES_KEY = 'dms_files';
const TRASH_KEY = 'dms_trash';

export interface TrashItemDTO {
  item: FileItem;
  deletedAt: string;
  deletedBy: string;
  originalParentId: string | null;
}

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

// 建立系統初始資料夾結構
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

function loadFiles(): FileItem[] {
  const saved = localStorage.getItem(FILES_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { /* fall through */ }
  }
  const initial = buildInitialFolders();
  localStorage.setItem(FILES_KEY, JSON.stringify(initial));
  return initial;
}

function saveFiles(files: FileItem[]) {
  localStorage.setItem(FILES_KEY, JSON.stringify(files));
}

function loadTrash(): TrashItemDTO[] {
  const saved = localStorage.getItem(TRASH_KEY);
  if (saved) {
    try { return JSON.parse(saved); } catch { /* fall through */ }
  }
  return [];
}

function saveTrash(items: TrashItemDTO[]) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(items));
}

// 確保系統資料夾存在（不會重建已刪除的課別，但會補齊 zone 和 department）
function ensureSystemFolders(existing: FileItem[]): FileItem[] {
  const now = new Date().toISOString();
  const result = [...existing];
  const ids = new Set(result.map(f => f.id));

  ZONES.forEach(zone => {
    const zoneId = `zone_${zone}`;
    if (!ids.has(zoneId)) {
      result.push({
        id: zoneId, name: zone, type: 'folder', parentId: null,
        createdAt: now, updatedAt: now, createdBy: '系統',
        isSystem: true, folderLevel: 'zone', diskPath: buildDiskPath(zone),
      });
      ids.add(zoneId);
    }

    DEPARTMENTS.forEach(dept => {
      const deptId = `dept_${zone}_${dept}`;
      if (!ids.has(deptId)) {
        result.push({
          id: deptId, name: dept, type: 'folder', parentId: zoneId,
          createdAt: now, updatedAt: now, createdBy: '系統',
          isSystem: true, folderLevel: 'department', diskPath: buildDiskPath(zone, dept),
        });
        ids.add(deptId);
      }

      // 課別由管理員動態管理，依 localStorage 記錄補齊
      const sections = getDepartmentSections()[dept] ?? [];
      sections.forEach(sec => {
        const secId = `sec_${zone}_${dept}_${sec}`;
        if (!ids.has(secId)) {
          result.push({
            id: secId, name: sec, type: 'folder', parentId: deptId,
            createdAt: now, updatedAt: now, createdBy: '系統',
            isSystem: true, folderLevel: 'section', diskPath: buildDiskPath(zone, dept, sec),
          });
          ids.add(secId);
        }
      });
    });
  });

  return result;
}

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>(() => {
    const loaded = loadFiles();
    return ensureSystemFolders(loaded);
  });
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [trashItems, setTrashItems] = useState<TrashItemDTO[]>(() => loadTrash());
  const [loading] = useState(false);

  // 持久化
  useEffect(() => { saveFiles(files); }, [files]);
  useEffect(() => { saveTrash(trashItems); }, [trashItems]);

  const refreshFiles = useCallback(() => {
    const loaded = loadFiles();
    setFiles(ensureSystemFolders(loaded));
    setTrashItems(loadTrash());
  }, []);

  const addFile = useCallback((file: FileItem) => {
    setFiles(prev => [...prev, file]);
  }, []);

  const addFolder = useCallback((name: string, parentId: string | null) => {
    const now = new Date().toISOString();
    const folder: FileItem = {
      id: crypto.randomUUID(),
      name, type: 'folder', parentId,
      createdAt: now, updatedAt: now,
      createdBy: '使用者',
    };
    setFiles(prev => [...prev, folder]);
  }, []);

  const deleteItem = useCallback((id: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (target?.isSystem) return prev;
      return prev.filter(f => f.id !== id);
    });
  }, []);

  const renameItem = useCallback((id: string, newName: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== id || f.isSystem) return f;
      return { ...f, name: newName, updatedAt: new Date().toISOString() };
    }));
  }, []);

  const updateFileContent = useCallback((id: string, content: string) => {
    setFiles(prev => prev.map(f => {
      if (f.id !== id) return f;
      return { ...f, content, updatedAt: new Date().toISOString() };
    }));
  }, []);

  const moveToTrash = useCallback((id: string, userName: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (!target || target.isSystem) return prev;

      // 遞迴收集子項目
      const idsToRemove = new Set<string>();
      const collectChildren = (parentId: string) => {
        idsToRemove.add(parentId);
        prev.filter(f => f.parentId === parentId).forEach(child => collectChildren(child.id));
      };
      collectChildren(id);

      const removedItems = prev.filter(f => idsToRemove.has(f.id));
      const trashEntry: TrashItemDTO = {
        item: target,
        deletedAt: new Date().toISOString(),
        deletedBy: userName,
        originalParentId: target.parentId,
      };
      setTrashItems(prevTrash => [trashEntry, ...prevTrash]);

      return prev.filter(f => !idsToRemove.has(f.id));
    });
  }, []);

  const restoreFromTrash = useCallback((itemId: string) => {
    setTrashItems(prev => {
      const entry = prev.find(t => t.item.id === itemId);
      if (!entry) return prev;
      setFiles(f => [...f, entry.item]);
      return prev.filter(t => t.item.id !== itemId);
    });
  }, []);

  const permanentDelete = useCallback((itemId: string) => {
    setTrashItems(prev => prev.filter(t => t.item.id !== itemId));
  }, []);

  const emptyTrash = useCallback(() => {
    setTrashItems([]);
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

  const addSectionFolder = useCallback((department: string, section: string) => {
    const now = new Date().toISOString();
    setFiles(prev => {
      const newFiles = [...prev];
      // 在時效區和永久區各建立課別資料夾
      ZONES.forEach(zone => {
        const deptId = `dept_${zone}_${department}`;
        const secId = `sec_${zone}_${department}_${section}`;
        if (!newFiles.find(f => f.id === secId)) {
          newFiles.push({
            id: secId, name: section, type: 'folder', parentId: deptId,
            createdAt: now, updatedAt: now, createdBy: '系統',
            isSystem: true, folderLevel: 'section', diskPath: buildDiskPath(zone, department, section),
          });
        }
      });
      return newFiles;
    });
  }, []);

  const removeSectionFolder = useCallback((department: string, section: string) => {
    setFiles(prev => {
      const secIds = ZONES.map(zone => `sec_${zone}_${department}_${section}`);
      return prev.filter(f => !secIds.includes(f.id));
    });
  }, []);

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
