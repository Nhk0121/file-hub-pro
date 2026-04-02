import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface EditLock {
  fileId: string;
  userId: string;
  userName: string;
  lockedAt: string;
}

interface EditLockContextType {
  locks: EditLock[];
  acquireLock: (fileId: string) => boolean;
  releaseLock: (fileId: string) => void;
  getLock: (fileId: string) => EditLock | undefined;
  isLockedByOther: (fileId: string) => boolean;
}

const EditLockContext = createContext<EditLockContextType | null>(null);

const STORAGE_KEY = 'dms_edit_locks';
const LOCK_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes auto-expire

export const EditLockProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [locks, setLocks] = useState<EditLock[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Persist & clean expired locks
  useEffect(() => {
    const now = Date.now();
    const valid = locks.filter(l => now - new Date(l.lockedAt).getTime() < LOCK_TIMEOUT_MS);
    if (valid.length !== locks.length) {
      setLocks(valid);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(valid.length !== locks.length ? valid : locks));
  }, [locks]);

  // Release all locks from current user on unmount (tab close)
  useEffect(() => {
    const cleanup = () => {
      if (!user) return;
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        const current: EditLock[] = saved ? JSON.parse(saved) : [];
        const filtered = current.filter(l => l.userId !== user.id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      } catch {}
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, [user]);

  const getLock = useCallback((fileId: string) => {
    const now = Date.now();
    return locks.find(l => l.fileId === fileId && now - new Date(l.lockedAt).getTime() < LOCK_TIMEOUT_MS);
  }, [locks]);

  const isLockedByOther = useCallback((fileId: string) => {
    const lock = getLock(fileId);
    return !!lock && lock.userId !== user?.id;
  }, [getLock, user]);

  const acquireLock = useCallback((fileId: string) => {
    if (!user) return false;
    const existing = getLock(fileId);
    if (existing && existing.userId !== user.id) return false;
    
    setLocks(prev => {
      const filtered = prev.filter(l => l.fileId !== fileId);
      return [...filtered, { fileId, userId: user.id, userName: user.displayName, lockedAt: new Date().toISOString() }];
    });
    return true;
  }, [user, getLock]);

  const releaseLock = useCallback((fileId: string) => {
    setLocks(prev => prev.filter(l => l.fileId !== fileId));
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
