import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { useNavigate } from 'react-router-dom';
import fileService from '@/services/fileService';
import { setDepartmentSections } from '@/config/organization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, Lock, User, ArrowLeft, Zap, ShieldCheck } from 'lucide-react';
import { useMonthlyTheme } from '@/hooks/useMonthlyTheme';
import { toast } from 'sonner';
import { DEPARTMENTS, getSectionsForDepartment, JOB_TITLES } from '@/config/organization';
import type { ApplicantType } from '@/types';

const Login = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, allUsers, submitRegistration } = useAuth();
  const { addLog } = useAudit();
  const navigate = useNavigate();

  // 員工申請表單
  const [empForm, setEmpForm] = useState({
    username: '', password: '', confirmPassword: '',
    displayName: '', email: '', department: '', section: '', jobTitle: '', phone: '', extension: '',
  });

  // 外包人員申請表單
  const [conForm, setConForm] = useState({
    username: '', password: '', confirmPassword: '',
    displayName: '', email: '', department: '', section: '', phone: '', extension: '',
  });

  const empSections = empForm.department ? getSectionsForDepartment(empForm.department) : [];
  const conSections = conForm.department ? getSectionsForDepartment(conForm.department) : [];
  const theme = useMonthlyTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (success) {
      const foundUser = allUsers.find(u => u.username === username);
      if (foundUser) {
        addLog({ userId: foundUser.id, userName: foundUser.displayName, action: '登入' });
      }
      toast.success('登入成功');
      navigate('/');
    } else {
      toast.error('帳號或密碼錯誤');
    }
  };

  const validateCommon = (form: { username: string; password: string; confirmPassword: string; displayName: string }, type: ApplicantType) => {
    if (!form.username.trim() || !form.password.trim() || !form.displayName.trim()) {
      toast.error('請填寫帳號、密碼及姓名');
      return false;
    }
    if (type === '公司員工' && !/^\d{6}$/.test(form.username.trim())) {
      toast.error('公司員工帳號須為姓名代號數字6碼');
      return false;
    }
    if (type === '外包人員' && !/^09\d{8}$/.test(form.username.trim())) {
      toast.error('外包人員帳號須為手機號碼（09開頭共10碼）');
      return false;
    }
    if (form.password.length < 12) {
      toast.error('密碼至少需 12 個字元');
      return false;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('兩次密碼不一致');
      return false;
    }
    if (allUsers.some(u => u.username === form.username.trim())) {
      toast.error('帳號已存在');
      return false;
    }
    return true;
  };

  const handleEmployeeRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCommon(empForm, '公司員工')) return;

    submitRegistration({
      applicantType: '公司員工',
      username: empForm.username.trim(),
      password: empForm.password,
      displayName: empForm.displayName.trim(),
      email: empForm.email.trim(),
      department: empForm.department || undefined,
      section: empForm.section || undefined,
      jobTitle: empForm.jobTitle || undefined,
      phone: empForm.phone.trim() || undefined,
      extension: empForm.extension.trim() || undefined,
    });

    toast.success('帳號申請已送出，請等待管理員審核');
    setEmpForm({ username: '', password: '', confirmPassword: '', displayName: '', email: '', department: '', section: '', jobTitle: '', phone: '', extension: '' });
    setMode('login');
  };

  const handleContractorRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCommon(conForm, '外包人員')) return;

    submitRegistration({
      applicantType: '外包人員',
      username: conForm.username.trim(),
      password: conForm.password,
      displayName: conForm.displayName.trim(),
      email: conForm.email.trim(),
      department: conForm.department || undefined,
      section: conForm.section || undefined,
      jobTitle: '外包人員',
      phone: conForm.phone.trim() || undefined,
      extension: conForm.extension.trim() || undefined,
    });

    toast.success('帳號申請已送出，請等待管理員審核');
    setConForm({ username: '', password: '', confirmPassword: '', displayName: '', email: '', department: '', section: '', phone: '', extension: '' });
    setMode('login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background bg-grid p-4 relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-primary/5 rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full translate-x-1/2 translate-y-1/2 blur-3xl" />
      
      <div className="w-full max-w-lg relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-primary rounded-2xl flex items-center justify-center mb-4 glow-primary rotate-3 hover:rotate-0 transition-transform duration-300">
            <FileText className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">桃園區處文件管理系統</h1>
          <p className="text-muted-foreground mt-2 flex items-center gap-2">
            <Zap className="w-3 h-3" />
            Taoyuan District Document Management System
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{theme.name}主題</span>
          </p>
        </div>

        {mode === 'login' ? (
          <Card className="shadow-xl border-border/50 glow-card">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">使用者登入</CardTitle>
              <CardDescription>請輸入您的帳號與密碼</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">帳號</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="username" value={username} onChange={e => setUsername(e.target.value)} placeholder="請輸入帳號" className="pl-10" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密碼</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="請輸入密碼" className="pl-10" required />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? '登入中...' : '登入'}
                </Button>
              </form>
              <div className="mt-4 text-center">
                <Button variant="link" onClick={() => setMode('register')} className="text-sm">
                  還沒有帳號？申請帳號
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-border/50">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">申請帳號</CardTitle>
              <CardDescription>請選擇身分類型並填寫資料，管理員審核通過即可登入</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="employee" className="space-y-4">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="employee">公司員工</TabsTrigger>
                  <TabsTrigger value="contractor">外包人員</TabsTrigger>
                </TabsList>

                {/* 公司員工申請表 */}
                <TabsContent value="employee">
                  <form onSubmit={handleEmployeeRegister} className="space-y-3">
                    <div className="space-y-2">
                      <Label>帳號（姓名代號數字6碼）*</Label>
                      <Input value={empForm.username} onChange={e => setEmpForm(p => ({ ...p, username: e.target.value }))} placeholder="例如：123456" maxLength={6} required />
                    </div>
                    <div className="space-y-2">
                      <Label>姓名 *</Label>
                      <Input value={empForm.displayName} onChange={e => setEmpForm(p => ({ ...p, displayName: e.target.value }))} placeholder="請輸入姓名" required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>密碼（至少12位元）*</Label>
                        <Input type="password" value={empForm.password} onChange={e => setEmpForm(p => ({ ...p, password: e.target.value }))} placeholder="至少 12 字元" required />
                      </div>
                      <div className="space-y-2">
                        <Label>確認密碼 *</Label>
                        <Input type="password" value={empForm.confirmPassword} onChange={e => setEmpForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="再輸入一次" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>組別</Label>
                        <Select value={empForm.department} onValueChange={v => setEmpForm(p => ({ ...p, department: v, section: '' }))}>
                          <SelectTrigger><SelectValue placeholder="選擇組別" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>課別</Label>
                        {empSections.length > 0 ? (
                          <Select value={empForm.section} onValueChange={v => setEmpForm(p => ({ ...p, section: v }))}>
                            <SelectTrigger><SelectValue placeholder="選擇課別" /></SelectTrigger>
                            <SelectContent>
                              {empSections.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value="（此組別無課別）" disabled className="bg-muted" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>職稱</Label>
                      <Select value={empForm.jobTitle} onValueChange={v => setEmpForm(p => ({ ...p, jobTitle: v }))}>
                        <SelectTrigger><SelectValue placeholder="選擇職稱" /></SelectTrigger>
                        <SelectContent>
                          {JOB_TITLES.map(t => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>電子信箱</Label>
                      <Input type="email" value={empForm.email} onChange={e => setEmpForm(p => ({ ...p, email: e.target.value }))} placeholder="選填" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>電話</Label>
                        <Input value={empForm.phone} onChange={e => setEmpForm(p => ({ ...p, phone: e.target.value }))} placeholder="選填" />
                      </div>
                      <div className="space-y-2">
                        <Label>分機</Label>
                        <Input value={empForm.extension} onChange={e => setEmpForm(p => ({ ...p, extension: e.target.value }))} placeholder="選填" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">送出申請</Button>
                  </form>
                </TabsContent>

                {/* 外包人員申請表 */}
                <TabsContent value="contractor">
                  <form onSubmit={handleContractorRegister} className="space-y-3">
                    <div className="space-y-2">
                      <Label>帳號（手機號碼）*</Label>
                      <Input value={conForm.username} onChange={e => setConForm(p => ({ ...p, username: e.target.value }))} placeholder="例如：0912345678" maxLength={10} required />
                    </div>
                    <div className="space-y-2">
                      <Label>姓名 *</Label>
                      <Input value={conForm.displayName} onChange={e => setConForm(p => ({ ...p, displayName: e.target.value }))} placeholder="請輸入姓名" required />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>密碼（至少12位元）*</Label>
                        <Input type="password" value={conForm.password} onChange={e => setConForm(p => ({ ...p, password: e.target.value }))} placeholder="至少 12 字元" required />
                      </div>
                      <div className="space-y-2">
                        <Label>確認密碼 *</Label>
                        <Input type="password" value={conForm.confirmPassword} onChange={e => setConForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="再輸入一次" required />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>組別</Label>
                        <Select value={conForm.department} onValueChange={v => setConForm(p => ({ ...p, department: v, section: '' }))}>
                          <SelectTrigger><SelectValue placeholder="選擇組別" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>課別</Label>
                        {conSections.length > 0 ? (
                          <Select value={conForm.section} onValueChange={v => setConForm(p => ({ ...p, section: v }))}>
                            <SelectTrigger><SelectValue placeholder="選擇課別" /></SelectTrigger>
                            <SelectContent>
                              {conSections.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value="（此組別無課別）" disabled className="bg-muted" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>職稱</Label>
                      <Input value="外包人員" disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label>電子信箱</Label>
                      <Input type="email" value={conForm.email} onChange={e => setConForm(p => ({ ...p, email: e.target.value }))} placeholder="選填" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label>電話</Label>
                        <Input value={conForm.phone} onChange={e => setConForm(p => ({ ...p, phone: e.target.value }))} placeholder="選填" />
                      </div>
                      <div className="space-y-2">
                        <Label>分機</Label>
                        <Input value={conForm.extension} onChange={e => setConForm(p => ({ ...p, extension: e.target.value }))} placeholder="選填" />
                      </div>
                    </div>
                    <Button type="submit" className="w-full">送出申請</Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="mt-4 text-center">
                <Button variant="link" onClick={() => setMode('login')} className="text-sm">
                  <ArrowLeft className="w-3 h-3 mr-1" />返回登入
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 憑證安裝連結 */}
        <div className="mt-6 text-center">
          <a
            href="/cert-install"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            首次使用出現「不安全」警告？點此安裝系統憑證
          </a>
        </div>
      </div>
    </div>
  );
};

export default Login;
