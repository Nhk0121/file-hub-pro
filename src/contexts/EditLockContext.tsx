import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import editLockService, { type EditLockDTO } from '@/services/editLockService';

interface EditLockContextType {
  locks: EditLockDTO[];
  acquireLock: (fileId: string) => Promise<boolean>;
  releaseLock: (fileId: string) => Promise<void>;
  getLock: (fileId: string) => EditLockDTO | undefined;
  isLockedByOther: (fileId: string) => boolean;
}

const EditLockContext = createContext<EditLockContextType | null>(null);

export const EditLockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [locks, setLocks] = useState<EditLockDTO[]>([]);

  // 初始載入
  useEffect(() => {
    const token = sessionStorage.getItem('dms_token');
    if (token) {
      editLockService.getAll().then(setLocks).catch(console.error);
    }
  }, []);

  // 頁面關閉時釋放鎖定
  useEffect(() => {
    const cleanup = () => {
      if (!user) return;
      locks.filter(l => l.userId === user.id).forEach(l => {
        // 使用 sendBeacon 確保在頁面關閉前送出
        const url = `${import.meta.env.VITE_API_BASE_URL || 'https://localhost:5001/api'}/edit-locks/${l.fileId}`;
        navigator.sendBeacon(url);
      });
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [user, locks]);

  const getLock = useCallback((fileId: string) => {
    return locks.find(l => l.fileId === fileId);
  }, [locks]);

  const isLockedByOther = useCallback((fileId: string) => {
    const lock = locks.find(l => l.fileId === fileId);
    return !!lock && lock.userId !== user?.id;
  }, [locks, user]);

  const acquireLock = useCallback(async (fileId: string) => {
    try {
      const result = await editLockService.acquire(fileId);
      if (result.success) {
        // 重新載入所有鎖定
        const updated = await editLockService.getAll();
        setLocks(updated);
      }
      return result.success;
    } catch {
      return false;
    }
  }, []);

  const releaseLock = useCallback(async (fileId: string) => {
    try {
      await editLockService.release(fileId);
      setLocks(prev => prev.filter(l => l.fileId !== fileId));
    } catch (err) {
      console.error('Failed to release lock:', err);
    }
  }, []);

  return (
    <EditLockContext.Provider value={{ locks, acquireLock, releaseLock, getLock, isLockedByOther }}>
      {children}
    </EditLockContext.Provider>
  );
};

export const useEditLock = () => {
  const ctx = useContext(EditLockContext);
  if (!ctx) throw new Error('useEditLock must be used within EditLockProvider');
  return ctx;
};
