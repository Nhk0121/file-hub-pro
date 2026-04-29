import { useFiles } from '@/contexts/FileContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Trash2, RotateCcw, AlertTriangle, Folder, FileText, Image, File,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import storageService from '@/services/storageService';

const RecycleBin = () => {
  const { trashItems, restoreFromTrash, permanentDelete, emptyTrash } = useFiles();
  const { user } = useAuth();
  const { addLog } = useAudit();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number>(30);

  useEffect(() => {
    storageService.getSettings()
      .then(s => setRetentionDays(s.trashRetentionDays || 30))
      .catch(() => setRetentionDays(30));
  }, []);

  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  // Only show root-level items (items whose parent is also in trash are children)
  const trashIds = new Set(trashItems.map(t => t.item.id));
  const rootItems = trashItems.filter(t => !trashIds.has(t.item.parentId ?? ''));

  const getIcon = (item: typeof trashItems[0]['item']) => {
    if (item.type === 'folder') return <Folder className="w-5 h-5 text-primary" />;
    if (item.mimeType?.startsWith('image/')) return <Image className="w-5 h-5 text-primary" />;
    if (item.name.endsWith('.md') || item.mimeType?.includes('text')) return <FileText className="w-5 h-5 text-primary" />;
    return <File className="w-5 h-5 text-muted-foreground" />;
  };

  const handleRestore = (itemId: string, name: string) => {
    restoreFromTrash(itemId);
    if (user) addLog({ userId: user.id, userName: user.displayName, action: '編輯', targetName: name, details: '從回收桶還原' });
    toast.success(`已還原「${name}」`);
  };

  const handlePermanentDelete = () => {
    if (!confirmDeleteId) return;
    const item = trashItems.find(t => t.item.id === confirmDeleteId);
    permanentDelete(confirmDeleteId);
    if (user && item) addLog({ userId: user.id, userName: user.displayName, action: '刪除', targetName: item.item.name, details: '永久刪除' });
    toast.success('已永久刪除');
    setConfirmDeleteId(null);
  };

  const handleEmptyTrash = () => {
    emptyTrash();
    if (user) addLog({ userId: user.id, userName: user.displayName, action: '刪除', details: '清空回收桶' });
    toast.success('回收桶已清空');
    setConfirmEmpty(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('zh-TW');
  const daysLeft = (d: string) => Math.max(0, 30 - Math.floor((Date.now() - new Date(d).getTime()) / 86400000));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Trash2 className="w-6 h-6 text-destructive" />
          <div>
            <h1 className="text-2xl font-bold">資源回收桶</h1>
            <p className="text-sm text-muted-foreground">刪除的檔案將保留 30 天，之後自動永久清除</p>
          </div>
        </div>
        {rootItems.length > 0 && isAdmin && (
          <Button variant="destructive" size="sm" onClick={() => setConfirmEmpty(true)}>
            <Trash2 className="w-4 h-4 mr-2" />清空回收桶
          </Button>
        )}
      </div>

      {rootItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Trash2 className="w-16 h-16 mb-4 opacity-20" />
          <p className="text-lg">回收桶是空的</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rootItems.map(({ item, deletedAt, deletedBy }) => (
            <div key={item.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
              <div className="shrink-0">{getIcon(item)}</div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  由 {deletedBy} 刪除於 {formatDate(deletedAt)}
                </p>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                {daysLeft(deletedAt)} 天後清除
              </Badge>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => handleRestore(item.id, item.name)} title="還原">
                  <RotateCcw className="w-4 h-4 mr-1" />還原
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmDeleteId(item.id)} title="永久刪除">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 永久刪除確認 */}
      <Dialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />永久刪除
            </DialogTitle>
            <DialogDescription>此操作無法復原，確定要永久刪除此項目嗎？</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>取消</Button>
            <Button variant="destructive" onClick={handlePermanentDelete}>永久刪除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 清空回收桶確認 */}
      <Dialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />清空回收桶
            </DialogTitle>
            <DialogDescription>將永久刪除回收桶中的所有 {rootItems.length} 個項目，此操作無法復原。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEmpty(false)}>取消</Button>
            <Button variant="destructive" onClick={handleEmptyTrash}>確認清空</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RecycleBin;
