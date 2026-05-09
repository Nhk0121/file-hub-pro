import React, { useEffect, useState, useMemo } from 'react';
import storageService, { DepartmentQuota } from '@/services/storageService';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Clock } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { useAuth } from '@/contexts/AuthContext';

const formatGB = (mb: number) => (mb / 1024).toFixed(1);

const QuotaRow: React.FC<{ q: DepartmentQuota }> = ({ q }) => {
  const usedMB = q.usedMB ?? 0;
  const quotaMB = q.quotaMB ?? 0;
  const remainMB = Math.max(0, quotaMB - usedMB);
  const pct = quotaMB > 0 ? Math.min(100, (usedMB / quotaMB) * 100) : 0;
  const danger = pct >= 90;
  const warn = pct >= 75;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium truncate">{q.department}</span>
        <span className={`font-mono ${danger ? 'text-destructive' : warn ? 'text-amber-500' : 'text-muted-foreground'}`}>
          剩餘 {formatGB(remainMB)} / {formatGB(quotaMB)} GB
        </span>
      </div>
      <Progress value={pct} className={`h-1 ${danger ? '[&>div]:bg-destructive' : warn ? '[&>div]:bg-amber-500' : ''}`} />
    </div>
  );
};

const GroupQuotaPanel: React.FC = () => {
  const { user } = useAuth();
  const [quotas, setQuotas] = useState<DepartmentQuota[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    storageService.getQuotas()
      .then(data => { if (mounted) setQuotas(data); })
      .catch(() => { if (mounted) setQuotas([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const myDept = user?.department;

  // 取得當前使用者所屬組別的彙總（永久 + 時效合併最差者顯示）
  const summary = useMemo(() => {
    if (!myDept) return null;
    const mine = quotas.filter(q => q.department === myDept);
    if (mine.length === 0) return null;
    const totalQuota = mine.reduce((s, q) => s + (q.quotaMB || 0), 0);
    const totalUsed = mine.reduce((s, q) => s + (q.usedMB || 0), 0);
    const remain = Math.max(0, totalQuota - totalUsed);
    const pct = totalQuota > 0 ? (totalUsed / totalQuota) * 100 : 0;
    return { totalQuota, totalUsed, remain, pct };
  }, [quotas, myDept]);

  if (loading || quotas.length === 0) return null;

  const permanent = quotas.filter(q => q.zone === '永久區');
  const timed = quotas.filter(q => q.zone === '時效區');

  const danger = (summary?.pct ?? 0) >= 90;
  const warn = (summary?.pct ?? 0) >= 75;
  const dotColor = danger ? 'bg-destructive' : warn ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 bg-muted/50 hover:bg-muted px-3 py-1.5 rounded-full text-sm text-muted-foreground transition-colors"
        >
          <HardDrive className="w-4 h-4 text-primary" />
          {summary ? (
            <>
              <span className="font-medium text-foreground">{myDept}</span>
              <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
              <span className="font-mono text-xs">剩餘 {formatGB(summary.remain)} GB</span>
            </>
          ) : (
            <span>各組空間</span>
          )}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="end" className="w-96 p-4 space-y-4">
        <div className="text-sm font-semibold flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          各組剩餘空間
        </div>
        {permanent.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <HardDrive className="w-3 h-3" /> 永久區
            </div>
            <div className="space-y-2">
              {permanent.map(q => <QuotaRow key={`p-${q.department}`} q={q} />)}
            </div>
          </div>
        )}
        {timed.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" /> 時效區
            </div>
            <div className="space-y-2">
              {timed.map(q => <QuotaRow key={`t-${q.department}`} q={q} />)}
            </div>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
};

export default GroupQuotaPanel;
