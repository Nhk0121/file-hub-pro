import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

import type { FileItem } from '@/types';
import { DEPARTMENTS, ZONES, buildDiskPath, getDepartmentSections } from '@/config/organization';

interface TrashItem {
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
  // 回收桶
  trashItems: TrashItem[];
  moveToTrash: (id: string, userName: string) => void;
  restoreFromTrash: (itemId: string) => void;
  permanentDelete: (itemId: string) => void;
  emptyTrash: () => void;
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

      const sections = getDepartmentSections()[dept] ?? [];
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

// 每次都動態計算，不快取
function getInitialFiles() {
  return buildInitialFolders();
}

export const FileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [files, setFiles] = useState<FileItem[]>(() => {
    // 一次性清除所有課別資料夾（v3 遷移標記）
    const migrated = localStorage.getItem('dms_sections_cleared_v3');
    if (!migrated) {
      localStorage.removeItem('dms_department_sections');
      const saved = localStorage.getItem('dms_files_v2');
      if (saved) {
        const parsed = JSON.parse(saved) as FileItem[];
        const cleaned = parsed.filter(f => f.folderLevel !== 'section');
        localStorage.setItem('dms_files_v2', JSON.stringify(cleaned));
      }
      localStorage.setItem('dms_sections_cleared_v3', '1');
    }

    const saved = localStorage.getItem('dms_files_v2');
    const initial = getInitialFiles();
    if (saved) {
      const parsed = JSON.parse(saved) as FileItem[];
      const existingIds = new Set(parsed.map(f => f.id));
      const missing = initial.filter(f => f.folderLevel !== 'section' && !existingIds.has(f.id));
      if (missing.length > 0) {
        const merged = [...parsed, ...missing];
        localStorage.setItem('dms_files_v2', JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }
    localStorage.setItem('dms_files_v2', JSON.stringify(initial));
    return initial;
  });

  // 時效區自動清除：30 天以上的非資料夾檔案自動移至回收桶
  const autoCleanTimedZone = useCallback((currentFiles: FileItem[]) => {
    const now = Date.now();
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const timedZone = currentFiles.find(f => f.folderLevel === 'zone' && f.name === '時效區');
    if (!timedZone) return currentFiles;

    const isUnderTimedZone = (fileId: string | null): boolean => {
      let fid = fileId;
      while (fid) {
        if (fid === timedZone.id) return true;
        const parent = currentFiles.find(f => f.id === fid);
        if (!parent) break;
        fid = parent.parentId;
      }
      return false;
    };

    const expired: FileItem[] = [];
    currentFiles.forEach(f => {
      if (f.type === 'file' && !f.isSystem && isUnderTimedZone(f.parentId)) {
        const age = now - new Date(f.createdAt).getTime();
        if (age > THIRTY_DAYS) expired.push(f);
      }
    });

    if (expired.length === 0) return currentFiles;

    // Move expired to trash
    const expiredIds = new Set(expired.map(f => f.id));
    const trashKey = 'dms_trash_v1';
    try {
      const saved = localStorage.getItem(trashKey);
      const existing: TrashItem[] = saved ? JSON.parse(saved) : [];
      const newTrash = [
        ...existing,
        ...expired.map(item => ({
          item,
          deletedAt: new Date().toISOString(),
          deletedBy: '系統（時效區自動清除）',
          originalParentId: item.parentId,
        })),
      ];
      localStorage.setItem(trashKey, JSON.stringify(newTrash));
    } catch {}

    const cleaned = currentFiles.filter(f => !expiredIds.has(f.id));
    localStorage.setItem('dms_files_v2', JSON.stringify(cleaned));
    return cleaned;
  }, []);

  // 初始化時執行自動清除
  useState(() => {
    setFiles(prev => autoCleanTimedZone(prev));
  });

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);

  // 回收桶
  const TRASH_KEY = 'dms_trash_v1';
  const [trashItems, setTrashItems] = useState<TrashItem[]>(() => {
    try {
      const saved = localStorage.getItem(TRASH_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as TrashItem[];
        // 自動清除 30 天以上的項目
        const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
        return parsed.filter(t => new Date(t.deletedAt).getTime() > cutoff);
      }
    } catch {}
    return [];
  });

  const persistTrash = (items: TrashItem[]) => {
    setTrashItems(items);
    localStorage.setItem(TRASH_KEY, JSON.stringify(items));
  };

  const moveToTrash = useCallback((id: string, userName: string) => {
    setFiles(prev => {
      const target = prev.find(f => f.id === id);
      if (!target || target.isSystem) return prev;
      // Collect item and all children
      const collected: FileItem[] = [];
      const collect = (targetId: string) => {
        const item = prev.find(f => f.id === targetId);
        if (item) collected.push(item);
        prev.filter(f => f.parentId === targetId).forEach(f => collect(f.id));
      };
      collect(id);
      const collectedIds = new Set(collected.map(f => f.id));
      const next = prev.filter(f => !collectedIds.has(f.id));
      localStorage.setItem('dms_files_v2', JSON.stringify(next));

      // Add to trash
      setTrashItems(prevTrash => {
        const newTrash = [
          ...prevTrash,
          ...collected.map(item => ({
            item,
            deletedAt: new Date().toISOString(),
            deletedBy: userName,
            originalParentId: item.id === id ? (item.parentId ?? null) : item.parentId,
          } as TrashItem)),
        ];
        localStorage.setItem(TRASH_KEY, JSON.stringify(newTrash));
        return newTrash;
      });

      return next;
    });
  }, []);

  const restoreFromTrash = useCallback((itemId: string) => {
    setTrashItems(prevTrash => {
      // Find the root item and all its children in trash
      const rootTrash = prevTrash.find(t => t.item.id === itemId);
      if (!rootTrash) return prevTrash;

      // Collect root + children
      const toRestore: TrashItem[] = [rootTrash];
      const collectChildren = (parentId: string) => {
        prevTrash.filter(t => t.item.parentId === parentId).forEach(t => {
          toRestore.push(t);
          collectChildren(t.item.id);
        });
      };
      collectChildren(itemId);

      const restoreIds = new Set(toRestore.map(t => t.item.id));
      const remaining = prevTrash.filter(t => !restoreIds.has(t.item.id));
      localStorage.setItem(TRASH_KEY, JSON.stringify(remaining));

      // Restore files
      setFiles(prev => {
        const restored = toRestore.map(t => t.item);
        const next = [...prev, ...restored];
        localStorage.setItem('dms_files_v2', JSON.stringify(next));
        return next;
      });

      return remaining;
    });
  }, []);

  const permanentDelete = useCallback((itemId: string) => {
    setTrashItems(prev => {
      const toDelete = new Set<string>();
      const collect = (id: string) => {
        toDelete.add(id);
        prev.filter(t => t.item.parentId === id).forEach(t => collect(t.item.id));
      };
      collect(itemId);
      const remaining = prev.filter(t => !toDelete.has(t.item.id));
      localStorage.setItem(TRASH_KEY, JSON.stringify(remaining));
      return remaining;
    });
  }, []);

  const emptyTrash = useCallback(() => {
    persistTrash([]);
  }, []);

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

  // 新增課別資料夾（在所有 zone 下的對應 department 下建立）
  const addSectionFolder = useCallback((department: string, section: string) => {
    setFiles(prev => {
      const now = new Date().toISOString();
      const newFolders: FileItem[] = [];
      ZONES.forEach(zone => {
        const deptFolder = prev.find(f => f.folderLevel === 'department' && f.name === department && f.parentId?.startsWith('zone_'));
        // find actual dept folder under this zone
        const deptId = `dept_${zone}_${department}`;
        const exists = prev.some(f => f.id === `sec_${zone}_${department}_${section}`);
        if (!exists) {
          newFolders.push({
            id: `sec_${zone}_${department}_${section}`,
            name: section,
            type: 'folder',
            parentId: deptId,
            createdAt: now,
            updatedAt: now,
            createdBy: '系統',
            isSystem: true,
            folderLevel: 'section',
            diskPath: buildDiskPath(zone, department, section),
          });
        }
      });
      if (newFolders.length === 0) return prev;
      const next = [...prev, ...newFolders];
      localStorage.setItem('dms_files_v2', JSON.stringify(next));
      return next;
    });
  }, []);

  // 刪除課別資料夾（從所有 zone 下移除）
  const removeSectionFolder = useCallback((department: string, section: string) => {
    setFiles(prev => {
      const toRemoveIds = new Set<string>();
      ZONES.forEach(zone => {
        const secId = `sec_${zone}_${department}_${section}`;
        // 收集該資料夾及其所有子項
        const collect = (id: string) => {
          toRemoveIds.add(id);
          prev.filter(f => f.parentId === id).forEach(f => collect(f.id));
        };
        if (prev.some(f => f.id === secId)) collect(secId);
      });
      if (toRemoveIds.size === 0) return prev;
      const next = prev.filter(f => !toRemoveIds.has(f.id));
      localStorage.setItem('dms_files_v2', JSON.stringify(next));
      return next;
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
