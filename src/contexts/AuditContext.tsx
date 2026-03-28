import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AuditLog } from '@/types';

interface AuditContextType {
  logs: AuditLog[];
  addLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  clearLogs: () => void;
}

const AuditContext = createContext<AuditContextType | null>(null);

export const AuditProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('dms_audit_logs');
    return saved ? JSON.parse(saved) : [];
  });

  const addLog = useCallback((log: Omit<AuditLog, 'id' | 'timestamp'>) => {
    setLogs(prev => {
      const newLog: AuditLog = {
        ...log,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };
      const next = [newLog, ...prev].slice(0, 1000); // 保留最近 1000 筆
      localStorage.setItem('dms_audit_logs', JSON.stringify(next));
      return next;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
    localStorage.removeItem('dms_audit_logs');
  }, []);

  return (
    <AuditContext.Provider value={{ logs, addLog, clearLogs }}>
      {children}
    </AuditContext.Provider>
  );
};

export const useAudit = () => {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within AuditProvider');
  return ctx;
};
