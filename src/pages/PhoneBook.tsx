import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Search, Lock } from 'lucide-react';
import { DEPARTMENTS } from '@/config/organization';

const PhoneBook = () => {
  const { user, allUsers } = useAuth();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('全部');

  // 僅員工帳號可閱覽
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

  // 僅顯示非外包人員
  const employees = allUsers.filter(u => u.role !== '外包人員');

  const filtered = employees.filter(u => {
    const matchSearch = !search ||
      u.displayName?.includes(search) ||
      u.department?.includes(search) ||
      u.section?.includes(search) ||
      u.jobTitle?.includes(search) ||
      u.phone?.includes(search) ||
      u.extension?.includes(search);
    const matchDept = deptFilter === '全部' || u.department === deptFilter;
    return matchSearch && matchDept;
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
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜尋姓名、組別、電話..." className="pl-9" />
              </div>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="全部">全部組別</SelectItem>
                  {DEPARTMENTS.map(d => (<SelectItem key={d} value={d}>{d}</SelectItem>))}
                </SelectContent>
              </Select>
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
