import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { AuditLog } from '@/types';
import auditService from '@/services/auditService';

interface AuditContextType {
  logs: AuditLog[];
  loading: boolean;
  addLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
  refreshLogs: () => Promise<void>;
}

const AuditContext = createContext<AuditContextType | null>(null);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshLogs = useCallback(async () => {
    setLoading(true);
    try {
      // 抓更多筆數，避免只看到最近 100 筆
      const data = await auditService.getAll({ page: 1, pageSize: 1000 });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 初始載入
  useEffect(() => {
    const token = sessionStorage.getItem('dms_token');
    if (token) refreshLogs();
  }, [refreshLogs]);

  const addLog = useCallback(async (log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    try {
      await auditService.add(log);
      // 樂觀更新：同時在前端加入
      const optimistic: AuditLog = {
        ...log,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      setLogs(prev => [optimistic, ...prev].slice(0, 1000));
    } catch (err) {
      console.error('Failed to add audit log:', err);
    }
  }, []);

  const clearLogs = useCallback(async () => {
    try {
      await auditService.clear();
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear audit logs:', err);
    }
  }, []);

  return (
    <AuditContext.Provider value={{ logs, addLog, clearLogs, refreshLogs }}>
      {children}
    </AuditContext.Provider>
  );
};

export const useAudit = () => {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within AuditProvider');
  return ctx;
};
