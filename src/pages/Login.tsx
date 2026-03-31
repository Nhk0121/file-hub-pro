import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Lock, User, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { DEPARTMENTS, getSectionsForDepartment } from '@/config/organization';

const Login = () => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, allUsers, submitRegistration } = useAuth();
  const { addLog } = useAudit();
  const navigate = useNavigate();

  // 申請表單
  const [regForm, setRegForm] = useState({
    username: '', password: '', confirmPassword: '',
    displayName: '', email: '', department: '', section: '', phone: '',
  });

  const regSections = regForm.department ? getSectionsForDepartment(regForm.department) : [];

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

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regForm.username.trim() || !regForm.password.trim() || !regForm.displayName.trim()) {
      toast.error('請填寫帳號、密碼及姓名');
      return;
    }
    if (regForm.password !== regForm.confirmPassword) {
      toast.error('兩次密碼不一致');
      return;
    }
    if (regForm.password.length < 6) {
      toast.error('密碼至少需 6 個字元');
      return;
    }
    if (allUsers.some(u => u.username === regForm.username.trim())) {
      toast.error('帳號已存在');
      return;
    }

    submitRegistration({
      username: regForm.username.trim(),
      password: regForm.password,
      displayName: regForm.displayName.trim(),
      email: regForm.email.trim(),
      department: regForm.department || undefined,
      section: regForm.section || undefined,
      phone: regForm.phone.trim() || undefined,
    });

    toast.success('帳號申請已送出，請等待管理員審核');
    setRegForm({ username: '', password: '', confirmPassword: '', displayName: '', email: '', department: '', section: '', phone: '' });
    setMode('login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground">文件管理系統</h1>
          <p className="text-muted-foreground mt-2">Document Management System</p>
        </div>

        {mode === 'login' ? (
          <Card className="shadow-xl border-border/50">
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
              <div className="mt-4 p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground text-center mb-2">測試帳號</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>管理員：admin / admin123</p>
                  <p>使用者：user / user123</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="shadow-xl border-border/50">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">申請帳號</CardTitle>
              <CardDescription>填寫資料後，管理員審核通過即可登入</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleRegister} className="space-y-3">
                <div className="space-y-2">
                  <Label>帳號 *</Label>
                  <Input value={regForm.username} onChange={e => setRegForm(p => ({ ...p, username: e.target.value }))} placeholder="請輸入帳號" required />
                </div>
                <div className="space-y-2">
                  <Label>姓名 *</Label>
                  <Input value={regForm.displayName} onChange={e => setRegForm(p => ({ ...p, displayName: e.target.value }))} placeholder="請輸入姓名" required />
                </div>
                <div className="space-y-2">
                  <Label>電子信箱</Label>
                  <Input type="email" value={regForm.email} onChange={e => setRegForm(p => ({ ...p, email: e.target.value }))} placeholder="選填" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label>密碼 *</Label>
                    <Input type="password" value={regForm.password} onChange={e => setRegForm(p => ({ ...p, password: e.target.value }))} placeholder="至少 6 字元" required />
                  </div>
                  <div className="space-y-2">
                    <Label>確認密碼 *</Label>
                    <Input type="password" value={regForm.confirmPassword} onChange={e => setRegForm(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="再輸入一次" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>組別</Label>
                  <Select value={regForm.department} onValueChange={v => setRegForm(p => ({ ...p, department: v, section: '' }))}>
                    <SelectTrigger><SelectValue placeholder="選擇組別（選填）" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {regSections.length > 0 && (
                  <div className="space-y-2">
                    <Label>課別</Label>
                    <Select value={regForm.section} onValueChange={v => setRegForm(p => ({ ...p, section: v }))}>
                      <SelectTrigger><SelectValue placeholder="選擇課別（選填）" /></SelectTrigger>
                      <SelectContent>
                        {regSections.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>電話</Label>
                  <Input value={regForm.phone} onChange={e => setRegForm(p => ({ ...p, phone: e.target.value }))} placeholder="選填" />
                </div>
                <Button type="submit" className="w-full">送出申請</Button>
              </form>
              <div className="mt-4 text-center">
                <Button variant="link" onClick={() => setMode('login')} className="text-sm">
                  <ArrowLeft className="w-3 h-3 mr-1" />返回登入
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Login;
