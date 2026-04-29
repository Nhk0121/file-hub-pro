import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { UserPlus, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import type { RegistrationStatus } from '@/types';

const ContractorApplication = () => {
  const { user, registrations, reviewRegistration } = useAuth();
  const { addLog } = useAudit();
  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  // 僅顯示外包人員的申請（公司員工申請於「系統管理 → 帳號審核」處理）
  const contractorApps = useMemo(() => {
    const list = Array.isArray(registrations) ? registrations : [];
    return list
      .filter(r => r.applicantType === '外包人員' && r.status !== '已核准')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [registrations]);

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
              <p className="text-sm text-muted-foreground">審核外包人員帳號申請（外包人員僅能存取時效區）</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle>外包人員申請列表</CardTitle>
            <CardDescription>
              申請來源：登入頁面 → 申請帳號 → 外包人員。外包人員僅能存取「時效區」，無法使用「永久區」。
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
                    <TableHead>組別/課別</TableHead>
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
                        {app.department || '-'}{app.section ? ` / ${app.section}` : ''}
                      </TableCell>
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
      </div>
    </div>
  );
};

export default ContractorApplication;
