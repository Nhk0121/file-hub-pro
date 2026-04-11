import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { ContractorApplication as ContractorApp } from '@/types';

const ContractorApplication = () => {
  const { user, allUsers, addUser } = useAuth();
  const { addLog } = useAudit();
  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  const [applications, setApplications] = useState<ContractorApp[]>(() => {
    const saved = localStorage.getItem('dms_contractor_apps');
    return saved ? JSON.parse(saved) : [];
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    applicantName: '',
    company: '',
    purpose: '',
    startDate: '',
    endDate: '',
    username: '',
    password: '',
  });

  const saveApps = (apps: ContractorApp[]) => {
    setApplications(apps);
    localStorage.setItem('dms_contractor_apps', JSON.stringify(apps));
  };

  const handleSubmit = () => {
    if (!form.applicantName.trim() || !form.company.trim() || !form.username.trim() || !form.password.trim()) {
      toast.error('請填寫所有必填欄位');
      return;
    }
    // 檢查帳號是否已存在
    if (allUsers.some(u => u.username === form.username.trim())) {
      toast.error('帳號已存在，請使用其他帳號');
      return;
    }
    // 檢查是否已有相同帳號的待審核申請
    if (applications.some(a => a.status === '待審核' && form.username.trim() === (a as any).username)) {
      toast.error('此帳號已有待審核的申請，請勿重複提交');
      return;
    }

    const app: ContractorApp = {
      id: crypto.randomUUID(),
      applicantName: form.applicantName.trim(),
      company: form.company.trim(),
      purpose: form.purpose.trim(),
      startDate: form.startDate,
      endDate: form.endDate,
      status: '待審核',
      createdAt: new Date().toISOString(),
      createdBy: user?.displayName ?? '',
    };

    // 直接建立外包帳號（待審核）
    addUser({
      id: crypto.randomUUID(),
      username: form.username.trim(),
      displayName: form.applicantName.trim(),
      email: '',
      role: '外包人員',
    }, form.password.trim());

    saveApps([app, ...applications]);
    if (user) addLog({ userId: user.id, userName: user.displayName, action: '外包申請', targetName: form.applicantName, details: `公司: ${form.company}` });
    toast.success('外包人員申請已提交');
    setForm({ applicantName: '', company: '', purpose: '', startDate: '', endDate: '', username: '', password: '' });
    setDialogOpen(false);
  };

  const handleReview = (appId: string, status: '已核准' | '已拒絕') => {
    const next = applications.map(a =>
      a.id === appId ? { ...a, status, reviewedBy: user?.displayName, reviewedAt: new Date().toISOString() } : a
    );
    saveApps(next);
    toast.success(`申請已${status === '已核准' ? '核准' : '拒絕'}`);
  };

  const statusIcon = (status: ContractorApp['status']) => {
    switch (status) {
      case '待審核': return <Clock className="w-4 h-4 text-yellow-500" />;
      case '已核准': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case '已拒絕': return <XCircle className="w-4 h-4 text-destructive" />;
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserPlus className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">外包人員管理</h1>
              <p className="text-sm text-muted-foreground">申請與管理外包人員帳號（僅可存取時效區）</p>
            </div>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <UserPlus className="w-4 h-4 mr-2" />新增外包人員
          </Button>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>外包人員申請列表</CardTitle>
            <CardDescription>外包人員僅能存取「時效區」，無法使用「永久區」</CardDescription>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">尚無外包人員申請</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>公司</TableHead>
                    <TableHead>用途</TableHead>
                    <TableHead>期間</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>申請時間</TableHead>
                    {isAdmin && <TableHead className="text-right">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map(app => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.applicantName}</TableCell>
                      <TableCell>{app.company}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{app.purpose || '-'}</TableCell>
                      <TableCell className="text-xs">
                        {app.startDate && app.endDate ? `${app.startDate} ~ ${app.endDate}` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {statusIcon(app.status)}
                          <Badge variant={app.status === '已核准' ? 'default' : app.status === '已拒絕' ? 'destructive' : 'secondary'}>
                            {app.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{new Date(app.createdAt).toLocaleDateString('zh-TW')}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right space-x-1">
                          {app.status === '待審核' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleReview(app.id, '已核准')}>核准</Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReview(app.id, '已拒絕')}>拒絕</Button>
                            </>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增外包人員</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>姓名 *</Label>
              <Input value={form.applicantName} onChange={e => setForm(p => ({ ...p, applicantName: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>公司 *</Label>
              <Input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>用途說明</Label>
              <Input value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>開始日期</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>結束日期</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="border-t pt-3 space-y-3">
              <p className="text-sm text-muted-foreground">帳號設定</p>
              <div className="space-y-1">
                <Label>帳號 *</Label>
                <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>密碼 *</Label>
                <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit}>提交申請</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractorApplication;
