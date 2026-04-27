import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Search, Lock } from 'lucide-react';
import { DEPARTMENTS, JOB_TITLES, getSectionsForDepartment } from '@/config/organization';

const PhoneBook = () => {
  const { user, allUsers } = useAuth();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('全部');
  const [secFilter, setSecFilter] = useState('全部');

  // 組別變更時重置課別
  const handleDeptChange = (val: string) => {
    setDeptFilter(val);
    setSecFilter('全部');
  };

  // 取得目前選中組別的課別列表
  const availableSections = deptFilter !== '全部' ? getSectionsForDepartment(deptFilter) : [];

  if (user?.role === '外包人員') {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2"><Lock className="w-5 h-5" />存取被拒</CardTitle>
            <CardDescription>電話簿僅限公司員工閱覽。</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const employees = allUsers.filter(u => u.role !== '外包人員');

  const deptIndex = (d?: string) => {
    const i = DEPARTMENTS.indexOf(d as typeof DEPARTMENTS[number]);
    return i === -1 ? 999 : i;
  };
  const jobIndex = (j?: string) => {
    const i = JOB_TITLES.indexOf(j as typeof JOB_TITLES[number]);
    return i === -1 ? 999 : i;
  };

  const filtered = employees
    .filter(u => {
      const matchSearch = !search ||
        u.displayName?.includes(search) ||
        u.department?.includes(search) ||
        u.section?.includes(search) ||
        u.jobTitle?.includes(search) ||
        u.phone?.includes(search) ||
        u.extension?.includes(search);
      const matchDept = deptFilter === '全部' || u.department === deptFilter;
      const matchSec = secFilter === '全部' || u.section === secFilter;
      return matchSearch && matchDept && matchSec;
    })
    .sort((a, b) => {
      // 1. 組別代號
      const d = deptIndex(a.department) - deptIndex(b.department);
      if (d !== 0) return d;
      // 2. 課別（字典序，含代號排序）
      const s = (a.section || '').localeCompare(b.section || '', 'zh-Hant');
      if (s !== 0) return s;
      // 3. 職稱代號
      const j = jobIndex(a.jobTitle) - jobIndex(b.jobTitle);
      if (j !== 0) return j;
      // 4. 姓名（同職稱時備用）
      return (a.displayName || '').localeCompare(b.displayName || '', 'zh-Hant');
    });

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-card">
        <div className="flex items-center gap-3">
          <Phone className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">電話簿</h1>
            <p className="text-sm text-muted-foreground">公司員工通訊錄</p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 overflow-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名、電話..." className="pl-9" />
              </div>
              <Select value={deptFilter} onValueChange={handleDeptChange}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="全部">全部組別</SelectItem>
                  {DEPARTMENTS.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
              {availableSections.length > 0 && (
                <Select value={secFilter} onValueChange={setSecFilter}>
                  <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="全部">全部課別</SelectItem>
                    {availableSections.map(s => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">無符合條件的資料</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>組別</TableHead>
                    <TableHead>課別</TableHead>
                    <TableHead>職稱</TableHead>
                    <TableHead>姓名</TableHead>
                    <TableHead>電話</TableHead>
                    <TableHead>分機</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm">{u.department || '-'}</TableCell>
                      <TableCell className="text-sm">{u.section || '-'}</TableCell>
                      <TableCell className="text-sm">{u.jobTitle || '-'}</TableCell>
                      <TableCell className="font-medium">{u.displayName}</TableCell>
                      <TableCell className="text-sm">{u.phone || '-'}</TableCell>
                      <TableCell className="text-sm">{u.extension || '-'}</TableCell>
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

export default PhoneBook;
