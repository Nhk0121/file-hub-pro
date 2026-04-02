import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { User, Save } from 'lucide-react';
import { toast } from 'sonner';
import { DEPARTMENTS, getSectionsForDepartment, JOB_TITLES } from '@/config/organization';

const Profile = () => {
  const { user, updateProfile } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [employeeCode, setEmployeeCode] = useState(user?.employeeCode ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [section, setSection] = useState(user?.section ?? '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [extension, setExtension] = useState(user?.extension ?? '');

  const sections = getSectionsForDepartment(department);

  useEffect(() => {
    if (department !== user?.department) {
      setSection('');
    }
  }, [department, user?.department]);

  const handleSave = () => {
    updateProfile({
      displayName: displayName.trim() || user?.displayName,
      employeeCode: employeeCode.trim(),
      department,
      section,
      jobTitle,
      phone: phone.trim(),
      extension: extension.trim(),
    });
    toast.success('個人資料已更新');
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <User className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">個人資料</h1>
            <p className="text-sm text-muted-foreground">管理您的個人資訊</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>帳號資訊</CardTitle>
              <CardDescription>以下為系統帳號資訊，無法自行修改</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-4">
                <Label className="w-20 text-right text-muted-foreground">帳號</Label>
                <span className="font-medium">{user.username}</span>
              </div>
              <div className="flex items-center gap-4">
                <Label className="w-20 text-right text-muted-foreground">電子信箱</Label>
                <span>{user.email}</span>
              </div>
              <div className="flex items-center gap-4">
                <Label className="w-20 text-right text-muted-foreground">角色</Label>
                <Badge variant={user.role === '系統管理員' || user.role === '管理員' ? 'default' : user.role === '外包人員' ? 'outline' : 'secondary'}>
                  {user.role}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>個人資料</CardTitle>
              <CardDescription>請填寫您的個人資訊</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="請輸入姓名" />
                </div>
                <div className="space-y-2">
                  <Label>代號</Label>
                  <Input value={employeeCode} onChange={e => setEmployeeCode(e.target.value)} placeholder="請輸入代號" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>組別</Label>
                  <Select value={department} onValueChange={setDepartment}>
                    <SelectTrigger><SelectValue placeholder="請選擇組別" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>課別</Label>
                  {sections.length > 0 ? (
                    <Select value={section} onValueChange={setSection}>
                      <SelectTrigger><SelectValue placeholder="請選擇課別" /></SelectTrigger>
                      <SelectContent>
                        {sections.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value="（此組別無課別）" disabled className="bg-muted" />
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>職稱</Label>
                {user.role === '外包人員' ? (
                  <Input value="外包人員" disabled className="bg-muted" />
                ) : (
                  <Select value={jobTitle} onValueChange={setJobTitle}>
                    <SelectTrigger><SelectValue placeholder="請選擇職稱" /></SelectTrigger>
                    <SelectContent>
                      {JOB_TITLES.map(t => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>電話</Label>
                  <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="請輸入電話" />
                </div>
                <div className="space-y-2">
                  <Label>分機</Label>
                  <Input value={extension} onChange={e => setExtension(e.target.value)} placeholder="請輸入分機號碼" />
                </div>
              </div>

              <Button onClick={handleSave} className="w-full mt-2">
                <Save className="w-4 h-4 mr-2" />
                儲存變更
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
