import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFiles } from '@/contexts/FileContext';
import { useAudit } from '@/contexts/AuditContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Users, Shield, ScrollText, Settings, Search, Trash2, Plus, FolderOpen,
  UserPlus, Lock, Download, FileEdit, LogIn, LogOut, Upload, FolderPlus, Pencil,
} from 'lucide-react';
import type { FolderPermission, AuditLog } from '@/types';

const actionIcons: Record<AuditLog['action'], React.ReactNode> = {
  '登入': <LogIn className="w-4 h-4 text-green-500" />,
  '登出': <LogOut className="w-4 h-4 text-muted-foreground" />,
  '上傳': <Upload className="w-4 h-4 text-primary" />,
  '下載': <Download className="w-4 h-4 text-primary" />,
  '刪除': <Trash2 className="w-4 h-4 text-destructive" />,
  '建立資料夾': <FolderPlus className="w-4 h-4 text-primary" />,
  '重新命名': <Pencil className="w-4 h-4 text-warning" />,
  '編輯': <FileEdit className="w-4 h-4 text-primary" />,
  '權限變更': <Shield className="w-4 h-4 text-warning" />,
};

const Admin = () => {
  const { user, allUsers, addUser, removeUser } = useAuth();
  const { files } = useFiles();
  const { logs, clearLogs } = useAudit();
  const { setFolderPermission, getFolderRules, removeFolderPermission } = usePermissions();

  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState<string>('全部');
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', displayName: '', email: '', password: '', role: '使用者' as '管理員' | '使用者' });

  // 權限管理 state
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [permUserId, setPermUserId] = useState('');
  const [permLevel, setPermLevel] = useState<FolderPermission>('完整權限');

  const folders = files.filter(f => f.type === 'folder');

  if (user?.role !== '管理員') {
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
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error('請填寫帳號與密碼');
      return;
    }
    addUser({
      id: crypto.randomUUID(),
      username: newUser.username.trim(),
      displayName: newUser.displayName.trim() || newUser.username.trim(),
      email: newUser.email.trim(),
      role: newUser.role,
    }, newUser.password);
    toast.success(`已新增使用者「${newUser.username}」`);
    setNewUser({ username: '', displayName: '', email: '', password: '', role: '使用者' });
    setAddUserOpen(false);
  };

  const handleRemoveUser = (userId: string, username: string) => {
    if (userId === user.id) { toast.error('無法刪除自己的帳號'); return; }
    removeUser(userId);
    toast.success(`已刪除使用者「${username}」`);
  };

  const handleSetPermission = () => {
    if (!selectedFolderId || !permUserId) { toast.error('請選擇資料夾與使用者'); return; }
    setFolderPermission(selectedFolderId, permUserId, permLevel);
    toast.success('權限已更新');
  };

  // 過濾稽核日誌
  const filteredLogs = logs.filter(log => {
    const matchSearch = !auditSearch || log.userName.includes(auditSearch) || log.targetName?.includes(auditSearch) || log.details?.includes(auditSearch);
    const matchAction = auditActionFilter === '全部' || log.action === auditActionFilter;
    return matchSearch && matchAction;
  });

  const selectedFolderRules = selectedFolderId ? getFolderRules(selectedFolderId) : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Settings className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">系統管理</h1>
            <p className="text-sm text-muted-foreground">使用者管理、權限控制與稽核日誌</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="users" className="flex items-center gap-2"><Users className="w-4 h-4" />使用者管理</TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2"><Shield className="w-4 h-4" />權限設定</TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2"><ScrollText className="w-4 h-4" />稽核日誌</TabsTrigger>
          </TabsList>

          {/* 使用者管理 */}
          <TabsContent value="users">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>使用者管理</CardTitle>
                  <CardDescription>管理系統中的所有使用者帳號</CardDescription>
                </div>
                <Button onClick={() => setAddUserOpen(true)}><UserPlus className="w-4 h-4 mr-2" />新增使用者</Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>帳號</TableHead>
                      <TableHead>顯示名稱</TableHead>
                      <TableHead>電子信箱</TableHead>
                      <TableHead>角色</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allUsers.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.username}</TableCell>
                        <TableCell>{u.displayName}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell>
                          <Badge variant={u.role === '管理員' ? 'default' : 'secondary'}>{u.role}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
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
                        {allUsers.filter(u => u.role !== '管理員').map(u => (
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
            </div>
          </TabsContent>

          {/* 稽核日誌 */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>資安稽核日誌</CardTitle>
                  <CardDescription>追蹤所有使用者操作記錄</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => { clearLogs(); toast.success('已清除所有日誌'); }}>
                  <Trash2 className="w-4 h-4 mr-2" />清除日誌
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 mb-4">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input value={auditSearch} onChange={e => setAuditSearch(e.target.value)} placeholder="搜尋日誌..." className="pl-9" />
                  </div>
                  <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="全部">全部動作</SelectItem>
                      <SelectItem value="登入">登入</SelectItem>
                      <SelectItem value="登出">登出</SelectItem>
                      <SelectItem value="上傳">上傳</SelectItem>
                      <SelectItem value="下載">下載</SelectItem>
                      <SelectItem value="刪除">刪除</SelectItem>
                      <SelectItem value="編輯">編輯</SelectItem>
                      <SelectItem value="建立資料夾">建立資料夾</SelectItem>
                      <SelectItem value="重新命名">重新命名</SelectItem>
                      <SelectItem value="權限變更">權限變更</SelectItem>
                    </SelectContent>
                  </Select>
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
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString('zh-TW')}
                          </TableCell>
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
        <DialogContent>
          <DialogHeader><DialogTitle>新增使用者</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input placeholder="帳號" value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} />
            <Input placeholder="顯示名稱" value={newUser.displayName} onChange={e => setNewUser(p => ({ ...p, displayName: e.target.value }))} />
            <Input placeholder="電子信箱" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} />
            <Input placeholder="密碼" type="password" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} />
            <Select value={newUser.role} onValueChange={v => setNewUser(p => ({ ...p, role: v as '管理員' | '使用者' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="使用者">使用者</SelectItem>
                <SelectItem value="管理員">管理員</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddUserOpen(false)}>取消</Button>
            <Button onClick={handleAddUser}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
