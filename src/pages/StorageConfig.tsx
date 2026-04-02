import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  HardDrive, FolderOpen, Plus, Trash2, Lock, Save, Copy, Clock,
  CheckCircle, AlertTriangle, RefreshCw, Database,
} from 'lucide-react';
import { DEPARTMENTS } from '@/config/organization';

export interface StorageDisk {
  id: string;
  label: string;
  path: string;
  diskType: '主要' | '備份';
  enabled: boolean;
  createdAt: string;
  lastSyncAt?: string;
}

export interface BackupSchedule {
  enabled: boolean;
  frequency: '每日' | '每週' | '每月' | '手動';
  time: string;
  retentionDays: number;
}

export interface DepartmentQuota {
  department: string;
  zone: '永久區' | '時效區';
  quotaGB: number;
  usedGB: number;
}

export interface StorageSettings {
  primaryPath: string;
  disks: StorageDisk[];
  backupSchedule: BackupSchedule;
  autoCreateFolders: boolean;
  syncEnabled: boolean;
  departmentQuotas: DepartmentQuota[];
}

const DEFAULT_SETTINGS: StorageSettings = {
  primaryPath: 'D:\\DMS',
  disks: [
    {
      id: '1', label: '主要磁碟', path: 'D:\\DMS', diskType: '主要',
      enabled: true, createdAt: new Date().toISOString(),
    },
  ],
  backupSchedule: { enabled: false, frequency: '每日', time: '02:00', retentionDays: 30 },
  autoCreateFolders: true,
  syncEnabled: false,
  departmentQuotas: [
    ...DEPARTMENTS.map(dept => ({ department: dept, zone: '永久區' as const, quotaGB: 10, usedGB: Math.round(Math.random() * 3 * 100) / 100 })),
    ...DEPARTMENTS.map(dept => ({ department: dept, zone: '時效區' as const, quotaGB: 5, usedGB: Math.round(Math.random() * 2 * 100) / 100 })),
  ],
};

const getStoredSettings = (): StorageSettings => {
  const saved = localStorage.getItem('dms_storage_settings');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migration: if quotas don't have zone field or length mismatch, rebuild
      const hasZone = Array.isArray(parsed.departmentQuotas) && parsed.departmentQuotas.length > 0 && parsed.departmentQuotas[0]?.zone;
      if (!hasZone) {
        parsed.departmentQuotas = DEFAULT_SETTINGS.departmentQuotas;
        localStorage.setItem('dms_storage_settings', JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
};

const StorageConfig = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<StorageSettings>(getStoredSettings);
  const [addDiskOpen, setAddDiskOpen] = useState(false);
  const [newDisk, setNewDisk] = useState({ label: '', path: '', diskType: '備份' as StorageDisk['diskType'] });

  if (user?.role !== '管理員') {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2"><Lock className="w-5 h-5" />存取被拒</CardTitle>
            <CardDescription>僅管理員可設定儲存空間。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const saveSettings = (next: StorageSettings) => {
    setSettings(next);
    localStorage.setItem('dms_storage_settings', JSON.stringify(next));
  };

  const handleSave = () => { saveSettings(settings); toast.success('儲存設定已儲存'); };

  const handleAddDisk = () => {
    if (!newDisk.label.trim() || !newDisk.path.trim()) { toast.error('請填寫磁碟標籤與路徑'); return; }
    const disk: StorageDisk = {
      id: crypto.randomUUID(), label: newDisk.label.trim(), path: newDisk.path.trim(),
      diskType: newDisk.diskType, enabled: true, createdAt: new Date().toISOString(),
    };
    saveSettings({ ...settings, disks: [...settings.disks, disk] });
    setNewDisk({ label: '', path: '', diskType: '備份' });
    setAddDiskOpen(false);
    toast.success(`已新增磁碟「${disk.label}」`);
  };

  const handleRemoveDisk = (diskId: string) => {
    const disk = settings.disks.find(d => d.id === diskId);
    if (disk?.diskType === '主要') { toast.error('無法刪除主要磁碟'); return; }
    saveSettings({ ...settings, disks: settings.disks.filter(d => d.id !== diskId) });
    toast.success('已移除磁碟');
  };

  const handleToggleDisk = (diskId: string, enabled: boolean) => {
    saveSettings({ ...settings, disks: settings.disks.map(d => d.id === diskId ? { ...d, enabled } : d) });
  };

  const updateSchedule = (updates: Partial<BackupSchedule>) => {
    saveSettings({ ...settings, backupSchedule: { ...settings.backupSchedule, ...updates } });
  };

  const updateQuota = (dept: string, zone: string, quotaGB: number) => {
    saveSettings({
      ...settings,
      departmentQuotas: settings.departmentQuotas.map(q =>
        q.department === dept && q.zone === zone ? { ...q, quotaGB } : q
      ),
    });
  };

  const permanentQuotas = settings.departmentQuotas.filter(q => q.zone === '永久區');
  const timedQuotas = settings.departmentQuotas.filter(q => q.zone === '時效區');

  return (
    <div className="flex flex-col h-full bg-grid">
      <div className="px-6 pt-6 pb-4 border-b glass">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <HardDrive className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">儲存空間設定</h1>
              <p className="text-sm text-muted-foreground">設定實體伺服器儲存路徑、備份磁碟與各組空間限制</p>
            </div>
          </div>
          <Button onClick={handleSave} className="glow-primary">
            <Save className="w-4 h-4 mr-2" />儲存設定
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* 各組空間限制 */}
        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Database className="w-5 h-5 text-primary" />各組空間限制 — 永久區</CardTitle>
            <CardDescription>設定各組別在永久區的儲存空間上限（GB）</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>組別</TableHead>
                  <TableHead>已使用 (GB)</TableHead>
                  <TableHead>上限 (GB)</TableHead>
                  <TableHead>使用率</TableHead>
                  <TableHead className="w-32">設定上限</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {permanentQuotas.map(q => {
                  const pct = q.quotaGB > 0 ? Math.min(100, (q.usedGB / q.quotaGB) * 100) : 0;
                  return (
                    <TableRow key={q.department}>
                      <TableCell className="font-medium">{q.department}</TableCell>
                      <TableCell>{q.usedGB.toFixed(2)}</TableCell>
                      <TableCell>{q.quotaGB}</TableCell>
                      <TableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1 h-2" />
                          <span className={`text-xs font-medium ${pct > 80 ? 'text-destructive' : pct > 60 ? 'text-warning' : 'text-muted-foreground'}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} max={1000} value={q.quotaGB} onChange={e => updateQuota(q.department, '永久區', parseInt(e.target.value) || 10)} className="w-24 h-8 text-sm" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />各組空間限制 — 時效區</CardTitle>
            <CardDescription>設定各組別在時效區的儲存空間上限（GB），時效區檔案超過 30 天將自動清除</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>組別</TableHead>
                  <TableHead>已使用 (GB)</TableHead>
                  <TableHead>上限 (GB)</TableHead>
                  <TableHead>使用率</TableHead>
                  <TableHead className="w-32">設定上限</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timedQuotas.map(q => {
                  const pct = q.quotaGB > 0 ? Math.min(100, (q.usedGB / q.quotaGB) * 100) : 0;
                  return (
                    <TableRow key={q.department}>
                      <TableCell className="font-medium">{q.department}</TableCell>
                      <TableCell>{q.usedGB.toFixed(2)}</TableCell>
                      <TableCell>{q.quotaGB}</TableCell>
                      <TableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1 h-2" />
                          <span className={`text-xs font-medium ${pct > 80 ? 'text-destructive' : pct > 60 ? 'text-warning' : 'text-muted-foreground'}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input type="number" min={1} max={1000} value={q.quotaGB} onChange={e => updateQuota(q.department, '時效區', parseInt(e.target.value) || 5)} className="w-24 h-8 text-sm" />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 主要儲存路徑 */}
        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-primary" />主要儲存路徑</CardTitle>
            <CardDescription>系統檔案的主要儲存位置</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>主要路徑</Label>
              <Input value={settings.primaryPath} onChange={e => setSettings(prev => ({ ...prev, primaryPath: e.target.value }))} placeholder="例如：D:\DMS" className="font-mono" />
              <p className="text-xs text-muted-foreground">完整路徑範例：{settings.primaryPath}\時效區\02.設計組\資訊課</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>移機自動建立資料夾</Label>
                <p className="text-xs text-muted-foreground">部署至伺服器時，自動建立所有組別與課別的實體資料夾</p>
              </div>
              <Switch checked={settings.autoCreateFolders} onCheckedChange={v => setSettings(prev => ({ ...prev, autoCreateFolders: v }))} />
            </div>
          </CardContent>
        </Card>

        {/* 磁碟管理 */}
        <Card className="glow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><HardDrive className="w-5 h-5 text-primary" />磁碟管理</CardTitle>
              <CardDescription>設定主要磁碟與備份磁碟</CardDescription>
            </div>
            <Button variant="outline" onClick={() => setAddDiskOpen(true)}><Plus className="w-4 h-4 mr-2" />新增備份磁碟</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>狀態</TableHead>
                  <TableHead>標籤</TableHead>
                  <TableHead>路徑</TableHead>
                  <TableHead>類型</TableHead>
                  <TableHead>建立時間</TableHead>
                  <TableHead>最後同步</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {settings.disks.map(disk => (
                  <TableRow key={disk.id}>
                    <TableCell>
                      {disk.enabled ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                    </TableCell>
                    <TableCell className="font-medium">{disk.label}</TableCell>
                    <TableCell className="font-mono text-sm">{disk.path}</TableCell>
                    <TableCell>
                      <Badge variant={disk.diskType === '主要' ? 'default' : 'secondary'}>
                        {disk.diskType === '主要' ? <HardDrive className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                        {disk.diskType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(disk.createdAt).toLocaleDateString('zh-TW')}</TableCell>
                    <TableCell className="text-xs">{disk.lastSyncAt ? new Date(disk.lastSyncAt).toLocaleString('zh-TW') : '尚未同步'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Switch checked={disk.enabled} onCheckedChange={v => handleToggleDisk(disk.id, v)} disabled={disk.diskType === '主要'} />
                      {disk.diskType !== '主要' && (
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveDisk(disk.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 備份排程 */}
        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" />備份排程</CardTitle>
            <CardDescription>設定自動備份排程</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>啟用自動備份</Label>
                <p className="text-xs text-muted-foreground">依排程自動將主要磁碟內容備份至所有啟用的備份磁碟</p>
              </div>
              <Switch checked={settings.backupSchedule.enabled} onCheckedChange={v => updateSchedule({ enabled: v })} />
            </div>
            {settings.backupSchedule.enabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>備份頻率</Label>
                  <Select value={settings.backupSchedule.frequency} onValueChange={v => updateSchedule({ frequency: v as BackupSchedule['frequency'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="每日">每日</SelectItem>
                      <SelectItem value="每週">每週</SelectItem>
                      <SelectItem value="每月">每月</SelectItem>
                      <SelectItem value="手動">手動</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>備份時間</Label>
                  <Input type="time" value={settings.backupSchedule.time} onChange={e => updateSchedule({ time: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>保留天數</Label>
                  <Input type="number" min={1} max={365} value={settings.backupSchedule.retentionDays} onChange={e => updateSchedule({ retentionDays: parseInt(e.target.value) || 30 })} />
                </div>
              </div>
            )}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">備份機制說明</p>
                  <p>• 此設定儲存於資料庫，部署至 Windows Server 後由排程服務讀取執行</p>
                  <p>• 備份採用 Robocopy 鏡像模式，僅同步差異檔案</p>
                  <p>• 建議備份磁碟使用不同實體硬碟或 NAS</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={addDiskOpen} onOpenChange={setAddDiskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增備份磁碟</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>磁碟標籤 *</Label>
              <Input value={newDisk.label} onChange={e => setNewDisk(p => ({ ...p, label: e.target.value }))} placeholder="例如：備份磁碟 E" />
            </div>
            <div className="space-y-2">
              <Label>儲存路徑 *</Label>
              <Input value={newDisk.path} onChange={e => setNewDisk(p => ({ ...p, path: e.target.value }))} placeholder="例如：E:\DMS_Backup" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>磁碟類型</Label>
              <Select value={newDisk.diskType} onValueChange={v => setNewDisk(p => ({ ...p, diskType: v as StorageDisk['diskType'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="備份">備份磁碟</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDiskOpen(false)}>取消</Button>
            <Button onClick={handleAddDisk}>新增</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorageConfig;
