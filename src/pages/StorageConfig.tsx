import { useEffect, useState, useCallback } from 'react';
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
  CheckCircle, AlertTriangle, RefreshCw, Database, FolderPlus, Loader2,
} from 'lucide-react';
import storageService, {
  type StorageSettings, type BackupDisk, type DepartmentQuota, type DiskUsage,
} from '@/services/storageService';

const StorageConfig = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initializing, setInitializing] = useState(false);

  const [settings, setSettings] = useState<StorageSettings | null>(null);
  const [disks, setDisks] = useState<BackupDisk[]>([]);
  const [quotas, setQuotas] = useState<DepartmentQuota[]>([]);
  const [diskUsage, setDiskUsage] = useState<DiskUsage>({ totalMB: 0, usedMB: 0, freeMB: 0 });

  const [addDiskOpen, setAddDiskOpen] = useState(false);
  const [newDisk, setNewDisk] = useState({ label: '', path: '' });

  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      const [s, d, q, u] = await Promise.all([
        storageService.getSettings(),
        storageService.getDisks(),
        storageService.getQuotas(),
        storageService.getDiskUsage(),
      ]);
      setSettings(s);
      setDisks(d);
      setQuotas(q);
      setDiskUsage(u);
    } catch (err) {
      console.error('載入儲存設定失敗:', err);
      toast.error('載入失敗：無法連線至伺服器');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (isAdmin) loadAll(); }, [isAdmin, loadAll]);

  if (!isAdmin) {
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

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-muted-foreground">載入中...</span>
      </div>
    );
  }

  // ===== 操作：儲存全部設定 =====
  const handleSave = async () => {
    if (!settings.primaryPath.trim()) {
      toast.error('主要儲存路徑不可為空');
      return;
    }
    try {
      setSaving(true);
      await storageService.updateSettings({
        primaryPath: settings.primaryPath.trim(),
        autoCreateFolders: settings.autoCreateFolders,
        backupEnabled: settings.backupEnabled,
        backupFrequency: settings.backupFrequency,
        backupTime: settings.backupTime,
        backupRetentionDays: settings.backupRetentionDays,
        trashRetentionDays: settings.trashRetentionDays,
        tempZoneRetentionDays: settings.tempZoneRetentionDays,
      });
      // 重新讀取以取得最新主路徑與磁碟使用量
      await loadAll();
      toast.success('儲存設定已更新');
    } catch (err) {
      toast.error('儲存失敗，請檢查連線或權限');
    } finally {
      setSaving(false);
    }
  };

  // ===== 操作：移機自動建立資料夾 =====
  const handleInitializeFolders = async () => {
    if (!confirm(`即將在「${settings.primaryPath}」與所有啟用的備份磁碟下建立\n永久區/時效區 × 各組別 × 各課別的實體資料夾。\n\n是否繼續？`)) return;
    try {
      setInitializing(true);
      const result = await storageService.initializeFolders();
      if (result.errors.length > 0) {
        toast.warning(`已建立 ${result.created} 個、略過 ${result.skipped} 個，發生 ${result.errors.length} 個錯誤`);
        console.warn('初始化錯誤:', result.errors);
      } else {
        toast.success(`移機初始化完成：新建 ${result.created} 個資料夾、略過 ${result.skipped} 個既有資料夾`);
      }
    } catch {
      toast.error('初始化失敗，請確認伺服器路徑可寫入');
    } finally {
      setInitializing(false);
    }
  };

  // ===== 配額：即時寫入 =====
  const updateQuota = async (department: string, zone: string, quotaMB: number) => {
    setQuotas(prev => prev.map(q =>
      q.department === department && q.zone === zone ? { ...q, quotaMB } : q
    ));
    try {
      await storageService.updateQuota(department, zone, quotaMB);
    } catch {
      toast.error(`更新 ${department} (${zone}) 配額失敗`);
      loadAll();
    }
  };

  // ===== 備份磁碟 =====
  const handleAddDisk = async () => {
    if (!newDisk.label.trim() || !newDisk.path.trim()) { toast.error('請填寫磁碟標籤與路徑'); return; }
    try {
      const created = await storageService.addDisk(newDisk.label.trim(), newDisk.path.trim());
      setDisks(prev => [...prev, created]);
      setNewDisk({ label: '', path: '' });
      setAddDiskOpen(false);
      toast.success(`已新增備份磁碟「${created.label}」`);
    } catch {
      toast.error('新增磁碟失敗');
    }
  };

  const handleRemoveDisk = async (id: string) => {
    try {
      await storageService.removeDisk(id);
      setDisks(prev => prev.filter(d => d.id !== id));
      toast.success('已移除磁碟');
    } catch {
      toast.error('移除磁碟失敗');
    }
  };

  const handleToggleDisk = async (id: string, enabled: boolean) => {
    setDisks(prev => prev.map(d => d.id === id ? { ...d, enabled } : d));
    try {
      await storageService.updateDisk(id, { enabled });
    } catch {
      toast.error('切換磁碟狀態失敗');
      loadAll();
    }
  };

  const permanentQuotas = quotas.filter(q => q.zone === '永久區');
  const timedQuotas = quotas.filter(q => q.zone === '時效區');

  const usagePct = diskUsage.totalMB > 0 ? (diskUsage.usedMB / diskUsage.totalMB) * 100 : 0;

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
          <Button onClick={handleSave} className="glow-primary" disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            儲存設定
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* 主要儲存路徑（與磁碟管理同步） */}
        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><FolderOpen className="w-5 h-5 text-primary" />主要儲存路徑</CardTitle>
            <CardDescription>系統檔案的主要儲存位置；變更後將自動同步至下方「磁碟管理」中的主要磁碟。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>主要路徑</Label>
              <Input
                value={settings.primaryPath}
                onChange={e => setSettings({ ...settings, primaryPath: e.target.value })}
                placeholder="例如：D:\DMS"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                完整路徑範例：{settings.primaryPath}\時效區\02.設計組\資訊課
              </p>
            </div>

            {/* 實際磁碟使用量 */}
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">實體磁碟使用量（{settings.primaryPath.substring(0, 2)}）</span>
                <span className="font-medium">
                  {(diskUsage.usedMB / 1024).toFixed(1)} GB / {(diskUsage.totalMB / 1024).toFixed(1)} GB
                </span>
              </div>
              <Progress value={usagePct} className="h-2" />
              <p className="text-xs text-muted-foreground">剩餘 {(diskUsage.freeMB / 1024).toFixed(1)} GB</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>移機自動建立資料夾</Label>
                <p className="text-xs text-muted-foreground">啟用後，按下方按鈕可立即在主要路徑與備份磁碟下建立完整資料夾結構</p>
              </div>
              <Switch
                checked={settings.autoCreateFolders}
                onCheckedChange={v => setSettings({ ...settings, autoCreateFolders: v })}
              />
            </div>

            <Button
              onClick={handleInitializeFolders}
              disabled={initializing || !settings.autoCreateFolders}
              variant="secondary"
              className="w-full"
            >
              {initializing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FolderPlus className="w-4 h-4 mr-2" />}
              立即初始化／重建所有組別資料夾
            </Button>
            <p className="text-xs text-muted-foreground">
              將於 <span className="font-mono">{settings.primaryPath}</span> 下建立
              <Badge variant="outline" className="mx-1">永久區</Badge>
              <Badge variant="outline" className="mx-1">時效區</Badge>
              × 各組別 × 各課別 的實體資料夾（已存在會自動略過）。
            </p>
          </CardContent>
        </Card>

        {/* 磁碟管理 */}
        <Card className="glow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2"><HardDrive className="w-5 h-5 text-primary" />磁碟管理</CardTitle>
              <CardDescription>主要磁碟與備份磁碟（主要磁碟同步顯示上方「主要儲存路徑」）</CardDescription>
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
                {/* 主要磁碟列：與 settings.primaryPath 同步 */}
                <TableRow className="bg-muted/30">
                  <TableCell><CheckCircle className="w-4 h-4 text-green-500" /></TableCell>
                  <TableCell className="font-medium">主要磁碟</TableCell>
                  <TableCell className="font-mono text-sm">{settings.primaryPath}</TableCell>
                  <TableCell>
                    <Badge variant="default"><HardDrive className="w-3 h-3 mr-1" />主要</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{new Date(settings.updatedAt).toLocaleDateString('zh-TW')}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">即時讀寫</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">由「主要儲存路徑」管理</TableCell>
                </TableRow>

                {disks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                      尚無備份磁碟
                    </TableCell>
                  </TableRow>
                )}

                {disks.map(disk => (
                  <TableRow key={disk.id}>
                    <TableCell>
                      {disk.enabled ? <CheckCircle className="w-4 h-4 text-green-500" /> : <AlertTriangle className="w-4 h-4 text-yellow-500" />}
                    </TableCell>
                    <TableCell className="font-medium">{disk.label}</TableCell>
                    <TableCell className="font-mono text-sm">{disk.path}</TableCell>
                    <TableCell>
                      <Badge variant="secondary"><Copy className="w-3 h-3 mr-1" />備份</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{new Date(disk.createdAt).toLocaleDateString('zh-TW')}</TableCell>
                    <TableCell className="text-xs">
                      {disk.lastSyncAt ? new Date(disk.lastSyncAt).toLocaleString('zh-TW') : '尚未同步'}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Switch checked={disk.enabled} onCheckedChange={v => handleToggleDisk(disk.id, v)} />
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveDisk(disk.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 各組空間限制 — 永久區 */}
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
                {permanentQuotas.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">尚無資料</TableCell></TableRow>
                ) : permanentQuotas.map(q => {
                  const quotaGB = q.quotaMB / 1024;
                  const usedGB = q.usedMB / 1024;
                  const pct = quotaGB > 0 ? Math.min(100, (usedGB / quotaGB) * 100) : 0;
                  return (
                    <TableRow key={`perm-${q.department}`}>
                      <TableCell className="font-medium">{q.department}</TableCell>
                      <TableCell>{usedGB.toFixed(2)}</TableCell>
                      <TableCell>{quotaGB.toFixed(0)}</TableCell>
                      <TableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1 h-2" />
                          <span className={`text-xs font-medium ${pct > 80 ? 'text-destructive' : pct > 60 ? 'text-warning' : 'text-muted-foreground'}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={1} max={1000}
                          defaultValue={quotaGB}
                          onBlur={e => {
                            const newGB = parseInt(e.target.value) || 10;
                            if (newGB * 1024 !== q.quotaMB) updateQuota(q.department, '永久區', newGB * 1024);
                          }}
                          className="w-24 h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 各組空間限制 — 時效區 */}
        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />各組空間限制 — 時效區</CardTitle>
            <CardDescription>時效區檔案超過 {settings.tempZoneRetentionDays} 天將自動清除（可於下方「自動清除設定」調整）</CardDescription>
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
                {timedQuotas.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">尚無資料</TableCell></TableRow>
                ) : timedQuotas.map(q => {
                  const quotaGB = q.quotaMB / 1024;
                  const usedGB = q.usedMB / 1024;
                  const pct = quotaGB > 0 ? Math.min(100, (usedGB / quotaGB) * 100) : 0;
                  return (
                    <TableRow key={`temp-${q.department}`}>
                      <TableCell className="font-medium">{q.department}</TableCell>
                      <TableCell>{usedGB.toFixed(2)}</TableCell>
                      <TableCell>{quotaGB.toFixed(0)}</TableCell>
                      <TableCell className="w-48">
                        <div className="flex items-center gap-2">
                          <Progress value={pct} className="flex-1 h-2" />
                          <span className={`text-xs font-medium ${pct > 80 ? 'text-destructive' : pct > 60 ? 'text-warning' : 'text-muted-foreground'}`}>{pct.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number" min={1} max={1000}
                          defaultValue={quotaGB}
                          onBlur={e => {
                            const newGB = parseInt(e.target.value) || 5;
                            if (newGB * 1024 !== q.quotaMB) updateQuota(q.department, '時效區', newGB * 1024);
                          }}
                          className="w-24 h-8 text-sm"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* 自動清除設定 */}
        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />自動清除設定</CardTitle>
            <CardDescription>自定義回收桶與時效區檔案的保留天數，超過天數後將由排程自動清除</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>回收桶保留天數</Label>
              <Input
                type="number" min={1} max={365}
                value={settings.trashRetentionDays}
                onChange={e => setSettings({ ...settings, trashRetentionDays: Math.max(1, parseInt(e.target.value) || 30) })}
              />
              <p className="text-xs text-muted-foreground">已刪除檔案在回收桶中保留的天數（預設 30 天）</p>
            </div>
            <div className="space-y-2">
              <Label>時效區保留天數</Label>
              <Input
                type="number" min={1} max={3650}
                value={settings.tempZoneRetentionDays}
                onChange={e => setSettings({ ...settings, tempZoneRetentionDays: Math.max(1, parseInt(e.target.value) || 30) })}
              />
              <p className="text-xs text-muted-foreground">時效區內檔案自上傳起保留的天數（預設 30 天）</p>
            </div>
            <div className="md:col-span-2 p-3 bg-muted rounded-lg text-xs text-muted-foreground space-y-1">
              <p>• 變更後請按右上角「儲存設定」生效</p>
              <p>• 實際自動清除由 Windows 排程或背景服務讀取此設定執行；永久區檔案不受影響</p>
            </div>
          </CardContent>
        </Card>

        {/* 備份排程 */}
        <Card className="glow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" />備份排程</CardTitle>
            <CardDescription>備份目的地由上方「磁碟管理」中所有「啟用中」的備份磁碟決定</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 目前備份目的地清單 */}
            <div className="rounded-lg border p-3 space-y-2 bg-muted/20">
              <Label className="text-xs text-muted-foreground">目前備份目的地</Label>
              {disks.filter(d => d.enabled).length === 0 ? (
                <p className="text-sm text-warning flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  尚未啟用任何備份磁碟，請先到上方「磁碟管理」新增並啟用，否則備份不會執行。
                </p>
              ) : (
                <ul className="space-y-1">
                  {disks.filter(d => d.enabled).map(d => (
                    <li key={d.id} className="text-sm font-mono flex items-center gap-2">
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="font-sans text-muted-foreground">{d.label}：</span>{d.path}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label>啟用自動備份</Label>
                <p className="text-xs text-muted-foreground">依排程將主要磁碟內容同步至上述「啟用中」的備份磁碟</p>
              </div>
              <Switch
                checked={settings.backupEnabled}
                onCheckedChange={v => setSettings({ ...settings, backupEnabled: v })}
              />
            </div>
            {settings.backupEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>備份頻率</Label>
                  <Select
                    value={settings.backupFrequency}
                    onValueChange={v => setSettings({ ...settings, backupFrequency: v as StorageSettings['backupFrequency'] })}
                  >
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
                  <Input
                    type="time" value={settings.backupTime}
                    onChange={e => setSettings({ ...settings, backupTime: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>保留天數</Label>
                  <Input
                    type="number" min={1} max={365}
                    value={settings.backupRetentionDays}
                    onChange={e => setSettings({ ...settings, backupRetentionDays: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>
            )}
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-start gap-2">
                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">備份機制說明</p>
                  <p>• 此設定儲存於 MSSQL 資料庫，部署後由排程服務讀取執行</p>
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
