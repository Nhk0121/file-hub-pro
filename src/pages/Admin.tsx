import { useState, useMemo, useEffect } from 'react';
import storageService from '@/services/storageService';
import { useAuth } from '@/contexts/AuthContext';
import { useFiles } from '@/contexts/FileContext';
import { useAudit } from '@/contexts/AuditContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, Shield, ScrollText, Settings, Search, Trash2, Plus, FolderOpen,
  UserPlus, Lock, Download, FileEdit, LogIn, LogOut, Upload, FolderPlus, Pencil,
  Clock, CheckCircle, XCircle, ClipboardList, KeyRound, Building2,
  Eye, Printer, UserMinus, UserCog, FolderLock, FileSearch,
} from 'lucide-react';
import type { FolderPermission, AuditLog, UserRole, ApplicantType, User } from '@/types';
import { DEPARTMENTS, getSectionsForDepartment, JOB_TITLES, addSection, removeSection, getDepartmentSections } from '@/config/organization';

const actionIcons: Record<AuditLog['action'], React.ReactNode> = {
  '登入': <LogIn className="w-4 h-4 text-green-500" />,
  '登出': <LogOut className="w-4 h-4 text-muted-foreground" />,
  '上傳': <Upload className="w-4 h-4 text-primary" />,
  '下載': <Download className="w-4 h-4 text-primary" />,
  '刪除': <Trash2 className="w-4 h-4 text-destructive" />,
  '建立資料夾': <FolderPlus className="w-4 h-4 text-primary" />,
  '重新命名': <Pencil className="w-4 h-4 text-yellow-500" />,
  '編輯': <FileEdit className="w-4 h-4 text-primary" />,
  '權限變更': <Shield className="w-4 h-4 text-yellow-500" />,
  '外包申請': <UserPlus className="w-4 h-4 text-primary" />,
  '帳號申請': <UserPlus className="w-4 h-4 text-blue-500" />,
  '審核帳號': <CheckCircle className="w-4 h-4 text-green-500" />,
  '預覽': <Eye className="w-4 h-4 text-primary" />,
  '列印': <Printer className="w-4 h-4 text-primary" />,
  '密碼重置': <KeyRound className="w-4 h-4 text-yellow-500" />,
  '角色變更': <UserCog className="w-4 h-4 text-yellow-500" />,
  '帳號刪除': <UserMinus className="w-4 h-4 text-destructive" />,
  '資料夾權限變更': <FolderLock className="w-4 h-4 text-yellow-500" />,
  '個資存取': <FileSearch className="w-4 h-4 text-orange-500" />,
};

const Admin = () => {
  const { user, allUsers, addUser, removeUser, updateUser, updateUserRole, registrations, reviewRegistration, resetPassword, refreshUsers } = useAuth();
  const { files, addSectionFolder, removeSectionFolder } = useFiles();
  const { logs, clearLogs, addLog } = useAudit();
  const { setFolderPermission, getFolderRules, removeFolderPermission, permanentOverrides, setPermanentOverride, removePermanentOverride } = usePermissions();

  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('全部');
  const [auditUserFilter, setAuditUserFilter] = useState<string>('全部');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUserType, setNewUserType] = useState<ApplicantType>('公司員工');
  const [newUser, setNewUser] = useState({
    username: '', displayName: '', email: '', password: '',
    role: '使用者' as UserRole,
    department: '', section: '', jobTitle: '', phone: '', extension: '',
  });

  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [permUserId, setPermUserId] = useState('');
  const [permLevel, setPermLevel] = useState<FolderPermission>('完整權限');

  // 使用者搜尋
  const [userSearch, setUserSearch] = useState('');
  const [savingRoleIds, setSavingRoleIds] = useState<string[]>([]);

  // 編輯使用者
  const [editUserOpen, setEditUserOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    displayName: '', email: '', department: '', section: '', jobTitle: '', phone: '', extension: '',
  });

  // 永久區多組別權限
  const [permSpecialUserId, setPermSpecialUserId] = useState('');
  const [permSpecialDepts, setPermSpecialDepts] = useState<string[]>([]);

  // 組織管理
  const [orgSelectedDept, setOrgSelectedDept] = useState<string>('');
  const [newSectionName, setNewSectionName] = useState('');
  const [orgSections, setOrgSections] = useState<Record<string, string[]>>(getDepartmentSections);
  const [primaryPath, setPrimaryPath] = useState<string>('E:\\DMS');

  // 載入儲存空間設定的主要路徑（與儲存空間設定頁面同步）
  useEffect(() => {
    storageService.getSettings()
      .then(s => setPrimaryPath(s.primaryPath || 'E:\\DMS'))
      .catch(() => {/* 未連線時保留預設值 */});
    refreshUsers();
  }, [refreshUsers]);

  const folders = (Array.isArray(files) ? files : []).filter(f => f.type === 'folder');
  const visibleRegistrations = (Array.isArray(registrations) ? registrations : []).filter(r => r.status !== '已核准');
  const pendingCount = visibleRegistrations.filter(r => r.status === '待審核').length;

  const newUserSections = newUser.department ? getSectionsForDepartment(newUser.department) : [];
  const editUserSections = editForm.department ? getSectionsForDepartment(editForm.department) : [];

  const filteredLogs = useMemo(() => (Array.isArray(logs) ? logs : []).filter(log => {
    const matchSearch = !auditSearch || log.userName.includes(auditSearch) || log.targetName?.includes(auditSearch) || log.details?.includes(auditSearch);
    const matchAction = auditActionFilter === '全部' || log.action === auditActionFilter;
    const matchUser = auditUserFilter === '全部' || log.userName === auditUserFilter;
    const logDate = log.timestamp.slice(0, 10);
    const matchFrom = !auditDateFrom || logDate >= auditDateFrom;
    const matchTo = !auditDateTo || logDate <= auditDateTo;
    return matchSearch && matchAction && matchUser && matchFrom && matchTo;
  }), [logs, auditSearch, auditActionFilter, auditUserFilter, auditDateFrom, auditDateTo]);

  const auditUserNames = useMemo(() => {
    const names = new Set((Array.isArray(logs) ? logs : []).map(l => l.userName));
    return Array.from(names).sort();
  }, [logs]);

  if (user?.role !== '管理員' && user?.role !== '系統管理員') {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2"><Lock className="w-5 h-5" />存取被拒</CardTitle>
            <CardDescription>您沒有權限存取系統管理介面。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleAddUser = () => {
    if (!newUser.username.trim() || !newUser.password.trim() || !newUser.displayName.trim()) {
      toast.error('請填寫帳號、姓名與密碼');
      return;
    }
    if (newUserType === '公司員工' && !/^\d{6}$/.test(newUser.username.trim())) {
      toast.error('公司員工帳號須為6碼數字');
      return;
    }
    if (newUser.password.length < 12) {
      toast.error('密碼至少12位元');
      return;
    }
    if (allUsers.some(u => u.username === newUser.username.trim())) {
      toast.error('帳號已存在');
      return;
    }
    const role: UserRole = newUserType === '外包人員' ? '外包人員' : (newUser.role || '使用者');
    addUser({
      id: crypto.randomUUID(),
      username: newUser.username.trim(),
      displayName: newUser.displayName.trim(),
      email: newUser.email.trim(),
      role,
      applicantType: newUserType,
      department: newUser.department || undefined,
      section: newUser.section || undefined,
      jobTitle: newUserType === '外包人員' ? '外包人員' : (newUser.jobTitle || undefined),
      phone: newUser.phone || undefined,
      extension: newUser.extension || undefined,
    }, newUser.password);
    toast.success(`已新增使用者「${newUser.username}」`);
    setNewUser({ username: '', displayName: '', email: '', password: '', role: '使用者', department: '', section: '', jobTitle: '', phone: '', extension: '' });
    setAddUserOpen(false);
  };

  const handleRemoveUser = (userId: string, username: string) => {
    if (userId === user.id) { toast.error('無法刪除自己的帳號'); return; }
    removeUser(userId);
    addLog({ userId: user.id, userName: user.displayName, action: '帳號刪除', targetName: username });
    toast.success(`已刪除使用者「${username}」`);
  };

  const handleResetPassword = (userId: string, username: string) => {
    if (userId === user.id) { toast.error('無法重置自己的密碼'); return; }
    resetPassword(userId);
    addLog({ userId: user.id, userName: user.displayName, action: '密碼重置', targetName: username });
    toast.success(`已將「${username}」的密碼重置為 a0123456789+`);
  };

  const handleOpenEditUser = (u: User) => {
    setEditingUser(u);
    setEditForm({
      displayName: u.displayName || '',
      email: u.email || '',
      department: u.department || '',
      section: u.section || '',
      jobTitle: u.jobTitle || '',
      phone: u.phone || '',
      extension: u.extension || '',
    });
    setEditUserOpen(true);
  };

  const handleSaveEditUser = () => {
    if (!editingUser) return;
    if (!editForm.displayName.trim()) {
      toast.error('姓名不得為空');
      return;
    }
    updateUser(editingUser.id, {
      displayName: editForm.displayName.trim(),
      email: editForm.email.trim(),
      department: editForm.department || undefined,
      section: editForm.section || undefined,
      jobTitle: editForm.jobTitle || undefined,
      phone: editForm.phone || undefined,
      extension: editForm.extension || undefined,
    });
    addLog({ userId: user.id, userName: user.displayName, action: '編輯', targetName: editingUser.username, details: '編輯使用者資料' });
    toast.success(`已更新使用者「${editingUser.username}」的資料`);
    setEditUserOpen(false);
    setEditingUser(null);
  };

  const handleSetPermission = () => {
    if (!selectedFolderId || !permUserId) { toast.error('請選擇資料夾與使用者'); return; }
    setFolderPermission(selectedFolderId, permUserId, permLevel);
    toast.success('權限已更新');
  };

  const handleReviewRegistration = (regId: string, status: '已核准' | '已拒絕') => {
    reviewRegistration(regId, status, user.displayName);
    addLog({
      userId: user.id,
      userName: user.displayName,
      action: '審核帳號',
      targetName: registrations.find(r => r.id === regId)?.displayName,
      details: status,
    });
    toast.success(`帳號申請已${status === '已核准' ? '核准' : '拒絕'}`);
  };

  const handleAddSection = () => {
    if (!orgSelectedDept || !newSectionName.trim()) {
      toast.error('請選擇組別並輸入課別名稱');
      return;
    }
    const currentSections = getSectionsForDepartment(orgSelectedDept);
    if (currentSections.includes(newSectionName.trim())) {
      toast.error('該課別已存在');
      return;
    }
    const updated = addSection(orgSelectedDept, newSectionName.trim());
    // 同步建立資料夾
    addSectionFolder(orgSelectedDept, newSectionName.trim());
    setOrgSections({ ...updated });
    toast.success(`已新增課別「${newSectionName.trim()}」至「${orgSelectedDept}」`);
    setNewSectionName('');
  };

  const handleRemoveSection = (dept: string, section: string) => {
    const updated = removeSection(dept, section);
    // 同步刪除資料夾
    removeSectionFolder(dept, section);
    setOrgSections({ ...updated });
    toast.success(`已刪除課別「${section}」`);
  };


  const handleExportCSV = () => {
    const headers = ['時間', '使用者', '動作', '對象', '詳細資訊'];
    const rows = filteredLogs.map(log => [
      new Date(log.timestamp).toLocaleString('zh-TW'),
      log.userName,
      log.action,
      log.targetName ?? '',
      log.details ?? '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `稽核日誌_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已匯出 ${filteredLogs.length} 筆稽核紀錄`);
  };

  const selectedFolderRules = selectedFolderId ? getFolderRules(selectedFolderId) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">系統管理</h1>
            <p className="text-sm text-muted-foreground">使用者管理、組織架構、帳號審核、權限控制與稽核日誌</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5 max-w-3xl">
            <TabsTrigger value="users" className="flex items-center gap-2"><Users className="w-4 h-4" />使用者管理</TabsTrigger>
            <TabsTrigger value="organization" className="flex items-center gap-2"><Building2 className="w-4 h-4" />組織管理</TabsTrigger>
            <TabsTrigger value="registrations" className="flex items-center gap-2 relative">
              <ClipboardList className="w-4 h-4" />帳號審核
              {pendingCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 min-w-5 text-xs px-1">{pendingCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2"><Shield className="w-4 h-4" />權限設定</TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2"><ScrollText className="w-4 h-4" />稽核日誌</TabsTrigger>
          </TabsList>

          {/* 使用者管理 */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>使用者管理</CardTitle>
                  <CardDescription>管理系統中的所有使用者帳號，密碼重置一律為 a0123456789+</CardDescription>
                </div>
                <Button onClick={() => setAddUserOpen(true)}><UserPlus className="w-4 h-4 mr-2" />新增使用者</Button>
              </CardHeader>
              <CardContent>
                <div className="relative mb-4 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="搜尋帳號、姓名、組別..." className="pl-9" />
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>類型</TableHead>
                      <TableHead>帳號</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>組別/課別</TableHead>
                      <TableHead>職稱</TableHead>
                      <TableHead>電話/分機</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(Array.isArray(allUsers) ? allUsers : []).filter(u => {
                      if (!userSearch) return true;
                      const q = userSearch.toLowerCase();
                      return u.username.toLowerCase().includes(q) || u.displayName.toLowerCase().includes(q) || (u.department || '').toLowerCase().includes(q) || (u.section || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q);
                    }).map(u => (
                      <TableRow key={u.id}>
                        <TableCell>
                          <Badge variant={u.applicantType === '外包人員' ? 'outline' : 'secondary'}>
                            {u.applicantType || '公司員工'}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{u.username}</TableCell>
                        <TableCell>{u.displayName}</TableCell>
                        <TableCell className="text-sm">{u.department || '-'}{u.section ? ` / ${u.section}` : ''}</TableCell>
                        <TableCell className="text-sm">{u.jobTitle || '-'}</TableCell>
                        <TableCell className="text-sm">{u.phone || '-'}{u.extension ? ` #${u.extension}` : ''}</TableCell>
                        <TableCell>
                          <Select
                            value={u.role}
                            onValueChange={v => {
                              updateUserRole(u.id, v as UserRole);
                              addLog({ userId: user.id, userName: user.displayName, action: '角色變更', targetName: u.username, details: `→ ${v}` });
                            }}
                            disabled={u.id === user.id}
                          >
                            <SelectTrigger className="w-28 h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="系統管理員">系統管理員</SelectItem>
                              <SelectItem value="管理員">管理員</SelectItem>
                              <SelectItem value="使用者">使用者</SelectItem>
                              <SelectItem value="外包人員">外包人員</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="icon" title="編輯" onClick={() => handleOpenEditUser(u)} disabled={u.id === user.id}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="重置密碼" onClick={() => handleResetPassword(u.id, u.username)} disabled={u.id === user.id}>
                            <KeyRound className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveUser(u.id, u.username)} disabled={u.id === user.id}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 組織管理 */}
          <TabsContent value="organization">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>新增課別</CardTitle>
                  <CardDescription>選擇組別後新增下層課別，將同步建立對應資料夾</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="mb-1 block">選擇組別</Label>
                    <Select value={orgSelectedDept} onValueChange={v => setOrgSelectedDept(v)}>
                      <SelectTrigger><SelectValue placeholder="選擇組別" /></SelectTrigger>
                      <SelectContent>
                        {DEPARTMENTS.map(d => (
                          <SelectItem key={d} value={d}>{d}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="mb-1 block">課別名稱</Label>
                    <Input
                      value={newSectionName}
                      onChange={e => setNewSectionName(e.target.value)}
                      placeholder="例如：01.規劃課"
                      onKeyDown={e => e.key === 'Enter' && handleAddSection()}
                    />
                  </div>
                  <Button onClick={handleAddSection} className="w-full" disabled={!orgSelectedDept}>
                    <Plus className="w-4 h-4 mr-2" />新增課別
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>目前組織架構</CardTitle>
                  <CardDescription>{orgSelectedDept ? `${orgSelectedDept} 的課別` : '請選擇組別查看'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {!orgSelectedDept ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">請先於左側選擇組別</p>
                  ) : (orgSections[orgSelectedDept] ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">該組別尚無課別</p>
                  ) : (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>課別名稱</TableHead>
                            <TableHead>磁碟路徑</TableHead>
                            <TableHead className="text-right">操作</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(orgSections[orgSelectedDept] ?? []).map(sec => (
                            <TableRow key={sec}>
                              <TableCell className="font-medium align-top">{sec}</TableCell>
                              <TableCell className="text-xs text-muted-foreground font-mono">
                                <div>{primaryPath}\永久區\{orgSelectedDept}\{sec}</div>
                                <div>{primaryPath}\時效區\{orgSelectedDept}\{sec}</div>
                              </TableCell>
                              <TableCell className="text-right align-top">
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleRemoveSection(orgSelectedDept, sec)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <p className="mt-3 text-xs text-muted-foreground">
                        路徑來源：儲存空間設定 → 主要儲存路徑。修改該設定後此處會同步更新。
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 帳號審核 */}
          <TabsContent value="registrations">
            <Card>
              <CardHeader>
                <CardTitle>帳號申請審核</CardTitle>
                <CardDescription>審核使用者從登入頁面提交的帳號申請</CardDescription>
              </CardHeader>
              <CardContent>
                {registrations.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">尚無帳號申請</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>類型</TableHead>
                        <TableHead>帳號</TableHead>
                        <TableHead>姓名</TableHead>
                        <TableHead>組別/課別</TableHead>
                        <TableHead>職稱</TableHead>
                        <TableHead>電話/分機</TableHead>
                        <TableHead>狀態</TableHead>
                        <TableHead>申請時間</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {registrations.map(reg => (
                        <TableRow key={reg.id}>
                          <TableCell>
                            <Badge variant={reg.applicantType === '外包人員' ? 'outline' : 'secondary'}>
                              {reg.applicantType || '公司員工'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{reg.username}</TableCell>
                          <TableCell>{reg.displayName}</TableCell>
                          <TableCell className="text-sm">{reg.department || '-'}{reg.section ? ` / ${reg.section}` : ''}</TableCell>
                          <TableCell className="text-sm">{reg.jobTitle || '-'}</TableCell>
                          <TableCell className="text-sm">{reg.phone || '-'}{reg.extension ? ` #${reg.extension}` : ''}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {reg.status === '待審核' && <Clock className="w-4 h-4 text-yellow-500" />}
                              {reg.status === '已核准' && <CheckCircle className="w-4 h-4 text-green-500" />}
                              {reg.status === '已拒絕' && <XCircle className="w-4 h-4 text-destructive" />}
                              <Badge variant={reg.status === '已核准' ? 'default' : reg.status === '已拒絕' ? 'destructive' : 'secondary'}>
                                {reg.status}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{new Date(reg.createdAt).toLocaleString('zh-TW')}</TableCell>
                          <TableCell className="text-right space-x-1">
                            {reg.status === '待審核' && (
                              <>
                                <Button size="sm" variant="outline" onClick={() => handleReviewRegistration(reg.id, '已核准')}>
                                  <CheckCircle className="w-3 h-3 mr-1" />核准
                                </Button>
                                <Button size="sm" variant="destructive" onClick={() => handleReviewRegistration(reg.id, '已拒絕')}>
                                  <XCircle className="w-3 h-3 mr-1" />拒絕
                                </Button>
                              </>
                            )}
                            {reg.status !== '待審核' && (
                              <span className="text-xs text-muted-foreground">{reg.reviewedBy} 於 {reg.reviewedAt ? new Date(reg.reviewedAt).toLocaleDateString('zh-TW') : ''}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* 權限設定 */}
          <TabsContent value="permissions">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>資料夾權限設定</CardTitle>
                  <CardDescription>為特定資料夾設定使用者的存取權限</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">選擇資料夾</label>
                    <Select value={selectedFolderId ?? ''} onValueChange={v => setSelectedFolderId(v)}>
                      <SelectTrigger><SelectValue placeholder="選擇資料夾" /></SelectTrigger>
                      <SelectContent>
                        {folders.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            <span className="flex items-center gap-2"><FolderOpen className="w-4 h-4" />{f.name}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">選擇使用者</label>
                    <Select value={permUserId} onValueChange={setPermUserId}>
                      <SelectTrigger><SelectValue placeholder="選擇使用者" /></SelectTrigger>
                      <SelectContent>
                        {(Array.isArray(allUsers) ? allUsers : []).filter(u => u.role !== '管理員' && u.role !== '系統管理員').map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.displayName} ({u.username})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">權限等級</label>
                    <Select value={permLevel} onValueChange={v => setPermLevel(v as FolderPermission)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="完整權限">完整權限（上傳、下載、編輯、刪除）</SelectItem>
                        <SelectItem value="僅下載">僅下載（唯讀）</SelectItem>
                        <SelectItem value="無權限">無權限（無法存取）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleSetPermission} className="w-full"><Plus className="w-4 h-4 mr-2" />套用權限</Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>目前權限規則</CardTitle>
                  <CardDescription>{selectedFolderId ? `${folders.find(f => f.id === selectedFolderId)?.name} 的權限設定` : '請先選擇資料夾'}</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedFolderRules.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">尚無特殊權限設定（所有人皆為完整權限）</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>使用者</TableHead>
                          <TableHead>權限</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedFolderRules.map(rule => {
                          const ruleUser = allUsers.find(u => u.id === rule.userId);
                          return (
                            <TableRow key={rule.id}>
                              <TableCell>{ruleUser?.displayName ?? rule.userId}</TableCell>
                              <TableCell>
                                <Badge variant={rule.permission === '完整權限' ? 'default' : rule.permission === '僅下載' ? 'secondary' : 'destructive'}>
                                  {rule.permission}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeFolderPermission(rule.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* 永久區跨組別權限 */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FolderLock className="w-5 h-5" />永久區跨組別完整權限</CardTitle>
                  <CardDescription>授權特定使用者對永久區中非所屬組別的資料夾擁有完整權限（上傳、編輯、刪除）</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <Label className="text-sm font-medium mb-1 block">選擇使用者</Label>
                      <Select value={permSpecialUserId} onValueChange={v => {
                        setPermSpecialUserId(v);
                        const existing = permanentOverrides.find(o => o.userId === v);
                        setPermSpecialDepts(existing?.departments ?? []);
                      }}>
                        <SelectTrigger><SelectValue placeholder="選擇使用者" /></SelectTrigger>
                        <SelectContent>
                          {(Array.isArray(allUsers) ? allUsers : []).filter(u => u.role !== '系統管理員' && u.role !== '管理員').map(u => (
                            <SelectItem key={u.id} value={u.id}>{u.displayName} ({u.username}) - {u.department || '未設組別'}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2">
                      <Label className="text-sm font-medium mb-1 block">授權組別（可複選）</Label>
                      <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-background min-h-[40px]">
                        {DEPARTMENTS.map(dept => (
                          <label key={dept} className="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input
                              type="checkbox"
                              checked={permSpecialDepts.includes(dept)}
                              onChange={e => {
                                setPermSpecialDepts(prev =>
                                  e.target.checked ? [...prev, dept] : prev.filter(d => d !== dept)
                                );
                              }}
                              className="rounded border-input"
                            />
                            <span>{dept}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <Button onClick={() => {
                    if (!permSpecialUserId) { toast.error('請選擇使用者'); return; }
                    if (permSpecialDepts.length === 0) { toast.error('請至少選擇一個組別'); return; }
                    setPermanentOverride(permSpecialUserId, permSpecialDepts);
                    const u = allUsers.find(x => x.id === permSpecialUserId);
                    toast.success(`已授權「${u?.displayName}」${permSpecialDepts.length} 個組別的永久區完整權限`);
                  }}><Plus className="w-4 h-4 mr-2" />套用跨組別權限</Button>

                  {permanentOverrides.length > 0 && (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>使用者</TableHead>
                          <TableHead>所屬組別</TableHead>
                          <TableHead>授權組別</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {permanentOverrides.map(override => {
                          const oUser = allUsers.find(u => u.id === override.userId);
                          return (
                            <TableRow key={override.id}>
                              <TableCell className="font-medium">{oUser?.displayName ?? override.userId}</TableCell>
                              <TableCell className="text-sm">{oUser?.department || '-'}</TableCell>
                              <TableCell>
                                <div className="flex flex-wrap gap-1">
                                  {override.departments.map(d => (
                                    <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                                  ))}
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removePermanentOverride(override.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 稽核日誌 */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>資安稽核日誌</CardTitle>
                  <CardDescription>追蹤所有使用者操作記錄，共 {logs.length} 筆，篩選後 {filteredLogs.length} 筆</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={filteredLogs.length === 0}>
                    <Download className="w-4 h-4 mr-2" />匯出 CSV
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { clearLogs(); toast.success('已清除所有日誌'); }}>
                    <Trash2 className="w-4 h-4 mr-2" />清除日誌
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-end gap-3 mb-4">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="搜尋日誌..." className="pl-9" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block text-muted-foreground">事件類型</Label>
                    <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="全部">全部動作</SelectItem>
                        <SelectItem value="登入">登入</SelectItem>
                        <SelectItem value="登出">登出</SelectItem>
                        <SelectItem value="上傳">上傳</SelectItem>
                        <SelectItem value="下載">下載</SelectItem>
                        <SelectItem value="預覽">預覽</SelectItem>
                        <SelectItem value="列印">列印</SelectItem>
                        <SelectItem value="刪除">刪除</SelectItem>
                        <SelectItem value="編輯">編輯</SelectItem>
                        <SelectItem value="建立資料夾">建立資料夾</SelectItem>
                        <SelectItem value="重新命名">重新命名</SelectItem>
                        <SelectItem value="權限變更">權限變更</SelectItem>
                        <SelectItem value="資料夾權限變更">資料夾權限變更</SelectItem>
                        <SelectItem value="密碼重置">密碼重置</SelectItem>
                        <SelectItem value="角色變更">角色變更</SelectItem>
                        <SelectItem value="帳號刪除">帳號刪除</SelectItem>
                        <SelectItem value="個資存取">個資存取</SelectItem>
                        <SelectItem value="外包申請">外包申請</SelectItem>
                        <SelectItem value="帳號申請">帳號申請</SelectItem>
                        <SelectItem value="審核帳號">審核帳號</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block text-muted-foreground">使用者</Label>
                    <Select value={auditUserFilter} onValueChange={setAuditUserFilter}>
                      <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="全部">全部使用者</SelectItem>
                        {auditUserNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block text-muted-foreground">起始日期</Label>
                    <Input type="date" value={auditDateFrom} onChange={e => setAuditDateFrom(e.target.value)} className="w-40" />
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block text-muted-foreground">結束日期</Label>
                    <Input type="date" value={auditDateTo} onChange={e => setAuditDateTo(e.target.value)} className="w-40" />
                  </div>
                </div>

                {filteredLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">尚無稽核記錄</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>時間</TableHead>
                        <TableHead>使用者</TableHead>
                        <TableHead>動作</TableHead>
                        <TableHead>對象</TableHead>
                        <TableHead>詳細資訊</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.slice(0, 100).map(log => (
                        <TableRow key={log.id}>
                          <TableCell>{actionIcons[log.action]}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{new Date(log.timestamp).toLocaleString('zh-TW')}</TableCell>
                          <TableCell className="font-medium">{log.userName}</TableCell>
                          <TableCell><Badge variant="outline">{log.action}</Badge></TableCell>
                          <TableCell className="text-sm">{log.targetName ?? '-'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.details ?? '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* 新增使用者 Dialog */}
      <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>新增使用者</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">帳號類型</Label>
              <Select value={newUserType} onValueChange={v => { setNewUserType(v as ApplicantType); setNewUser(p => ({ ...p, username: '', jobTitle: '' })); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="公司員工">公司員工</SelectItem>
                  <SelectItem value="外包人員">外包人員</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block">{newUserType === '公司員工' ? '帳號（姓名代號6碼數字）*' : '帳號（手機號碼）*'}</Label>
              <Input
                value={newUser.username}
                onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))}
                placeholder={newUserType === '公司員工' ? '例如：123456' : '例如：0912345678'}
              />
            </div>
            <div>
              <Label className="mb-1 block">姓名 *</Label>
              <Input value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block">密碼 *（至少12位元）</Label>
              <Input type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            </div>
            {newUserType === '公司員工' && (
              <div>
                <Label className="mb-1 block">角色</Label>
                <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v as UserRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="使用者">使用者</SelectItem>
                    <SelectItem value="管理員">管理員</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="mb-1 block">組別</Label>
              <Select value={newUser.department} onValueChange={v => setNewUser(p => ({ ...p, department: v, section: '' }))}>
                <SelectTrigger><SelectValue placeholder="選擇組別" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {newUserSections.length > 0 && (
              <div>
                <Label className="mb-1 block">課別</Label>
                <Select value={newUser.section} onValueChange={v => setNewUser(p => ({ ...p, section: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇課別" /></SelectTrigger>
                  <SelectContent>
                    {newUserSections.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {newUserType === '公司員工' && (
              <div>
                <Label className="mb-1 block">職稱</Label>
                <Select value={newUser.jobTitle} onValueChange={v => setNewUser(p => ({ ...p, jobTitle: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇職稱" /></SelectTrigger>
                  <SelectContent>
                    {JOB_TITLES.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">電話</Label>
                <Input value={newUser.phone} onChange={e => setNewUser(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block">分機</Label>
                <Input value={newUser.extension} onChange={e => setNewUser(p => ({ ...p, extension: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">電子信箱</Label>
              <Input value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>取消</Button>
            <Button onClick={handleAddUser}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 編輯使用者 Dialog */}
      <Dialog open={editUserOpen} onOpenChange={setEditUserOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>編輯使用者 — {editingUser?.username}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block">姓名 *</Label>
              <Input value={editForm.displayName} onChange={e => setEditForm(p => ({ ...p, displayName: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1 block">組別</Label>
              <Select value={editForm.department} onValueChange={v => setEditForm(p => ({ ...p, department: v, section: '' }))}>
                <SelectTrigger><SelectValue placeholder="選擇組別" /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {editUserSections.length > 0 && (
              <div>
                <Label className="mb-1 block">課別</Label>
                <Select value={editForm.section} onValueChange={v => setEditForm(p => ({ ...p, section: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇課別" /></SelectTrigger>
                  <SelectContent>
                    {editUserSections.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editingUser?.applicantType !== '外包人員' && (
              <div>
                <Label className="mb-1 block">職稱</Label>
                <Select value={editForm.jobTitle} onValueChange={v => setEditForm(p => ({ ...p, jobTitle: v }))}>
                  <SelectTrigger><SelectValue placeholder="選擇職稱" /></SelectTrigger>
                  <SelectContent>
                    {JOB_TITLES.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="mb-1 block">電話</Label>
                <Input value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div>
                <Label className="mb-1 block">分機</Label>
                <Input value={editForm.extension} onChange={e => setEditForm(p => ({ ...p, extension: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">電子信箱</Label>
              <Input value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUserOpen(false)}>取消</Button>
            <Button onClick={handleSaveEditUser}>儲存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
