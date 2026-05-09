import { useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { UserPlus, CheckCircle, XCircle, Clock, Pencil, KeyRound, Trash2, Search, Ban, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type { RegistrationStatus, User } from '@/types';

const ContractorApplication = () => {
  const { user, allUsers, registrations, reviewRegistration, addUser, updateUser, removeUser, resetPassword, suspendUser } = useAuth();
  const { addLog } = useAudit();
  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  // 申請列表（僅外包）
  const contractorApps = useMemo(() => {
    const list = Array.isArray(registrations) ? registrations : [];
    return list
      .filter(r => r.applicantType === '外包人員' && r.status !== '已核准')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [registrations]);

  // 已建立之外包帳號
  const [search, setSearch] = useState('');
  const contractorUsers = useMemo(() => {
    const list = Array.isArray(allUsers) ? allUsers : [];
    const q = search.trim().toLowerCase();
    return list
      .filter(u => u.applicantType === '外包人員' || u.role === '外包人員')
      .filter(u => !q
        || u.username.toLowerCase().includes(q)
        || (u.displayName || '').toLowerCase().includes(q)
        || (u.phone || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q))
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || '', 'zh-Hant'));
  }, [allUsers, search]);

  // 新增外包
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ username: '', displayName: '', password: '', phone: '', email: '' });

  // 編輯外包
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({ displayName: '', phone: '', email: '' });

  const handleReview = async (regId: string, status: '已核准' | '已拒絕') => {
    if (!user) return;
    const target = contractorApps.find(a => a.id === regId);
    try {
      await reviewRegistration(regId, status, user.displayName);
      addLog({
        userId: user.id,
        userName: user.displayName,
        action: '審核帳號',
        targetName: target?.displayName,
        details: `外包人員 - ${status}`,
      });
      toast.success(`外包人員申請已${status === '已核准' ? '核准' : '拒絕'}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '審核失敗，請稍後再試');
    }
  };

  const handleAdd = async () => {
    if (!form.username.trim() || !form.password.trim() || !form.displayName.trim()) {
      toast.error('請填寫帳號、姓名與密碼');
      return;
    }
    if (form.password.length < 12) {
      toast.error('密碼至少 12 位元');
      return;
    }
    if ((allUsers || []).some(u => u.username === form.username.trim())) {
      toast.error('帳號已存在');
      return;
    }
    try {
      await addUser({
        id: crypto.randomUUID(),
        username: form.username.trim(),
        displayName: form.displayName.trim(),
        email: form.email.trim() || undefined,
        role: '外包人員',
        applicantType: '外包人員',
        jobTitle: '外包人員',
        phone: form.phone.trim() || undefined,
      } as User, form.password);
      toast.success(`已新增外包人員「${form.username}」`);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '審核帳號', targetName: form.displayName, details: '外包人員 - 直接建立' });
      setForm({ username: '', displayName: '', password: '', phone: '', email: '' });
      setAddOpen(false);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '新增失敗');
    }
  };

  const handleOpenEdit = (u: User) => {
    setEditing(u);
    setEditForm({ displayName: u.displayName || '', phone: u.phone || '', email: u.email || '' });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    try {
      await updateUser(editing.id, {
        displayName: editForm.displayName.trim(),
        phone: editForm.phone.trim() || undefined,
        email: editForm.email.trim() || undefined,
      });
      toast.success('已更新外包人員資料');
      setEditOpen(false);
      setEditing(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '更新失敗');
    }
  };

  const handleReset = async (u: User) => {
    if (!user) return;
    if (u.id === user.id) { toast.error('無法重置自己的密碼'); return; }
    try {
      await resetPassword(u.id);
      addLog({ userId: user.id, userName: user.displayName, action: '密碼重置', targetName: u.username });
      toast.success(`已將「${u.username}」的密碼重置為 a0123456789+`);
    } catch {
      toast.error('密碼重置失敗');
    }
  };

  const handleDelete = async (u: User) => {
    if (!user) return;
    if (u.id === user.id) { toast.error('無法刪除自己的帳號'); return; }
    if (!confirm(`確定刪除外包人員「${u.username}」？`)) return;
    try {
      await removeUser(u.id);
      addLog({ userId: user.id, userName: user.displayName, action: '帳號刪除', targetName: u.username });
      toast.success(`已刪除「${u.username}」`);
    } catch {
      toast.error('刪除失敗');
    }
  };

  const handleToggleSuspend = async (u: User) => {
    if (!user || u.id === user.id) return;
    if (u.isSuspended) {
      try {
        await suspendUser(u.id, false);
        addLog({ userId: user.id, userName: user.displayName, action: '角色變更', targetName: u.username, details: '解除停權' });
        toast.success(`已解除「${u.username}」的停權`);
      } catch { toast.error('解除停權失敗'); }
      return;
    }
    const reason = prompt(`要停權「${u.username}」嗎？\n請輸入停權原因（將顯示給使用者，可留空）：`, '');
    if (reason === null) return;
    try {
      await suspendUser(u.id, true, reason.trim() || undefined);
      addLog({
        userId: user.id, userName: user.displayName,
        action: '角色變更', targetName: u.username,
        details: `違規停權${reason.trim() ? `：${reason.trim()}` : ''}`,
      });
      toast.success(`已停權「${u.username}」`);
    } catch { toast.error('停權失敗'); }
  };
  const statusIcon = (status: RegistrationStatus) => {
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
              <p className="text-sm text-muted-foreground">外包人員的申請審核與帳號管理（外包人員僅能存取時效區）</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto space-y-6">
        {/* 申請審核 */}
        <Card>
          <CardHeader>
            <CardTitle>申請審核</CardTitle>
            <CardDescription>
              申請來源：登入頁面 → 申請帳號 → 外包人員。核准後即建立帳號並出現於下方列表。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {contractorApps.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">尚無外包人員申請</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>帳號（手機）</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>電話/分機</TableHead>
                    <TableHead>電子信箱</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>申請時間</TableHead>
                    {isAdmin && <TableHead className="text-right">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractorApps.map(app => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.username}</TableCell>
                      <TableCell>{app.displayName}</TableCell>
                      <TableCell className="text-sm">
                        {app.phone || '-'}{app.extension ? ` #${app.extension}` : ''}
                      </TableCell>
                      <TableCell className="text-sm">{app.email || '-'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {statusIcon(app.status)}
                          <Badge variant={app.status === '已核准' ? 'default' : app.status === '已拒絕' ? 'destructive' : 'secondary'}>
                            {app.status}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(app.createdAt).toLocaleString('zh-TW')}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right space-x-1">
                          {app.status === '待審核' && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => handleReview(app.id, '已核准')}>
                                <CheckCircle className="w-3 h-3 mr-1" />核准
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleReview(app.id, '已拒絕')}>
                                <XCircle className="w-3 h-3 mr-1" />拒絕
                              </Button>
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

        {/* 帳號管理 */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>帳號管理</CardTitle>
              <CardDescription>已建立之外包人員帳號清單，可於此編輯、重置密碼或刪除。密碼重置一律為 a0123456789+</CardDescription>
            </div>
            {isAdmin && (
              <Button onClick={() => setAddOpen(true)}><UserPlus className="w-4 h-4 mr-2" />新增外包人員</Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="relative max-w-sm mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋帳號、姓名、電話、信箱..." className="pl-9" />
            </div>
            {contractorUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">尚無外包人員帳號</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>帳號</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>電話</TableHead>
                    <TableHead>電子信箱</TableHead>
                    {isAdmin && <TableHead className="text-right">操作</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contractorUsers.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell>{u.displayName}</TableCell>
                      <TableCell className="text-sm">{u.phone || '-'}</TableCell>
                      <TableCell className="text-sm">{u.email || '-'}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" title="編輯" onClick={() => handleOpenEdit(u)} disabled={u.id === user?.id}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="重置密碼" onClick={() => handleReset(u)} disabled={u.id === user?.id}>
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" title="刪除" onClick={() => handleDelete(u)} disabled={u.id === user?.id}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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

      {/* 新增外包 Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>新增外包人員</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">帳號（手機號碼）*</Label>
              <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="例如：0912345678" />
            </div>
            <div>
              <Label className="mb-1 block">姓名 *</Label>
              <Input value={form.displayName} onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block">密碼 *（至少12位元）</Label>
              <Input type="password" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block">電話</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block">電子信箱</Label>
              <Input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>取消</Button>
            <Button onClick={handleAdd}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯外包 Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>編輯外包人員</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">帳號</Label>
              <Input value={editing?.username || ''} disabled />
            </div>
            <div>
              <Label className="mb-1 block">姓名</Label>
              <Input value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block">電話</Label>
              <Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block">電子信箱</Label>
              <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>取消</Button>
            <Button onClick={handleSaveEdit}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractorApplication;
