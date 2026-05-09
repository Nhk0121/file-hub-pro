import React, { useEffect, useState } from 'react';
import storageService, { DepartmentQuota } from '@/services/storageService';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

const formatGB = (mb: number) => (mb / 1024).toFixed(1);

const QuotaRow: React.FC<{ q: DepartmentQuota }> = ({ q }) => {
  const usedMB = q.usedMB ?? 0;
  const quotaMB = q.quotaMB ?? 0;
  const remainMB = Math.max(0, quotaMB - usedMB);
  const pct = quotaMB > 0 ? Math.min(100, (usedMB / quotaMB) * 100) : 0;
  const danger = pct >= 90;
  const warn = pct >= 75;

  return (
    <div className="space-y-1.5 p-3 rounded-lg border bg-card/50 hover:bg-card transition-colors">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate">{q.department}</span>
        <span className={`text-xs font-mono ${danger ? 'text-destructive' : warn ? 'text-amber-500' : 'text-muted-foreground'}`}>
          剩餘 {formatGB(remainMB)} / {formatGB(quotaMB)} GB
        </span>
      </div>
      <Progress value={pct} className={`h-1.5 ${danger ? '[&>div]:bg-destructive' : warn ? '[&>div]:bg-amber-500' : ''}`} />
    </div>
  );
};

const GroupQuotaPanel: React.FC = () => {
  const [quotas, setQuotas] = useState<DepartmentQuota[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let mounted = true;
    storageService.getQuotas()
      .then(data => { if (mounted) setQuotas(data); })
      .catch(() => { if (mounted) setQuotas([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  if (loading) return null;
  if (quotas.length === 0) return null;

  const permanent = quotas.filter(q => q.zone === '永久區');
  const timed = quotas.filter(q => q.zone === '時效區');

  return (
    <div className="border-b bg-muted/20">
      <div className="px-6 py-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-primary" />
          各組剩餘空間
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(o => !o)} className="h-7 text-xs">
          {open ? <><ChevronUp className="w-3 h-3 mr-1" />收合</> : <><ChevronDown className="w-3 h-3 mr-1" />展開</>}
        </Button>
      </div>
      {open && (
        <div className="px-6 pb-3 grid gap-3 md:grid-cols-2">
          {permanent.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <HardDrive className="w-3 h-3" /> 永久區
              </div>
              <div className="grid gap-2">
                {permanent.map(q => <QuotaRow key={`p-${q.department}`} q={q} />)}
              </div>
            </div>
          )}
          {timed.length > 0 && (
            <div>
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Clock className="w-3 h-3" /> 時效區
              </div>
              <div className="grid gap-2">
                {timed.map(q => <QuotaRow key={`t-${q.department}`} q={q} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default GroupQuotaPanel;
