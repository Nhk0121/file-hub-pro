import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import storageService from '@/services/storageService';

const DEFAULT_TITLE = '桃園區處文件管理系統';
const STORAGE_KEY = 'dms_system_title';

interface SystemTitleContextValue {
  title: string;
  shortTitle: string; // 側邊欄等狹窄空間使用
  setTitle: (next: string) => void;
  refresh: () => Promise<void>;
}

const SystemTitleContext = createContext<SystemTitleContextValue>({
  title: DEFAULT_TITLE,
  shortTitle: '桃園區處 DMS',
  setTitle: () => {},
  refresh: async () => {},
});

const computeShort = (full: string): string => {
  if (!full) return '桃園區處 DMS';
  // 取前 6 個中文字 + DMS，避免過長
  const trimmed = full.replace(/系統$/, '').slice(0, 8);
  return trimmed.length >= 4 ? `${trimmed} DMS`.trim() : `${full} DMS`;
};

export const SystemTitleProvider = ({ children }: { children: ReactNode }) => {
  // 啟動時優先使用 localStorage 快取，避免閃爍
  const [title, setTitleState] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEY) || DEFAULT_TITLE; } catch { return DEFAULT_TITLE; }
  });

  const applyTitle = useCallback((next: string) => {
    const safe = (next || '').trim() || DEFAULT_TITLE;
    setTitleState(safe);
    try { localStorage.setItem(STORAGE_KEY, safe); } catch { /* ignore */ }
    if (typeof document !== 'undefined') document.title = safe;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const s = await storageService.getSettings();
      if (s?.systemTitle) applyTitle(s.systemTitle);
    } catch {
      // 後端未連線時保留 fallback；不影響系統運作
    }
  }, [applyTitle]);

  useEffect(() => {
    document.title = title;
    refresh();
  }, [refresh]); // 僅在 mount 觸發一次

  return (
    <SystemTitleContext.Provider value={{ title, shortTitle: computeShort(title), setTitle: applyTitle, refresh }}>
      {children}
    </SystemTitleContext.Provider>
  );
};

export const useSystemTitle = () => useContext(SystemTitleContext);
