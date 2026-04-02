import { useFiles } from '@/contexts/FileContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { useEditLock } from '@/contexts/EditLockContext';
import { useNavigate } from 'react-router-dom';
import {
  ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Folder, FileText, Image, File, Download, Trash2, Pencil, FileCode, Lock, Clock, Archive, UserPen, Eye, AlertTriangle,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { FileItem } from '@/types';
import FilePreviewDialog from '@/components/files/FilePreviewDialog';

interface FileListProps {
  viewMode: 'grid' | 'list';
  searchQuery: string;
}

const getFileIcon = (item: FileItem) => {
  if (item.type === 'folder') {
    if (item.folderLevel === 'zone') {
      return item.name === '時效區'
        ? <Clock className="w-10 h-10 text-yellow-500" />
        : <Archive className="w-10 h-10 text-blue-500" />;
    }
    return <Folder className="w-10 h-10 text-primary" />;
  }
  if (item.mimeType?.startsWith('image/')) return <Image className="w-10 h-10 text-accent-foreground" />;
  if (item.name.endsWith('.md')) return <FileCode className="w-10 h-10 text-accent-foreground" />;
  if (item.mimeType?.includes('html')) return <FileText className="w-10 h-10 text-accent-foreground" />;
  return <File className="w-10 h-10 text-muted-foreground" />;
};

const formatSize = (bytes?: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso: string) => {
  return new Date(iso).toLocaleDateString('zh-TW', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
};

const FileList = ({ viewMode, searchQuery }: FileListProps) => {
  const { currentFolderId, setCurrentFolderId, getChildren, deleteItem, renameItem, isSystemFolder, files: allFiles, moveToTrash } = useFiles();
  const { user } = useAuth();
  const { addLog } = useAudit();
  const { getFolderPermission, getUserPermanentDepts } = usePermissions();
  const { getLock } = useEditLock();
  const navigate = useNavigate();
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamingItem, setRenamingItem] = useState<FileItem | null>(null);
  const [newName, setNewName] = useState('');
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  // 永久區權限邏輯：非管理員的公司員工在永久區僅可下載預覽，除非為該組別人員或有跨組別授權
  const permanentZoneInfo = (() => {
    if (!user || isAdmin || user.role === '外包人員') return null;
    let fid = currentFolderId;
    let inPermanent = false;
    let departmentFolder: string | null = null;
    while (fid) {
      const folder = allFiles.find(f => f.id === fid);
      if (!folder) break;
      if (folder.folderLevel === 'department') departmentFolder = folder.name;
      if (folder.folderLevel === 'zone' && folder.name === '永久區') inPermanent = true;
      fid = folder.parentId;
    }
    if (!inPermanent) return null;
    // 判斷是否為該組別人員或有跨組別授權
    const isSameDept = departmentFolder && user.department === departmentFolder;
    const overrideDepts = getUserPermanentDepts(user.id);
    const hasOverride = departmentFolder && overrideDepts.includes(departmentFolder);
    return { inPermanent: true, isSameDept: !!(isSameDept || hasOverride) };
  })();

  const permanentReadOnly = permanentZoneInfo?.inPermanent && !permanentZoneInfo.isSameDept;

  const currentPermission = user && currentFolderId
    ? (isAdmin ? '完整權限' : getFolderPermission(currentFolderId, user.id))
    : '完整權限';
  const canWrite = permanentReadOnly ? false : currentPermission === '完整權限';
  const canAccess = currentPermission !== '無權限';

  // 外包人員限制：只能存取時效區
  const isContractor = user?.role === '外包人員';
  // 檢查當前是否在永久區下
  const isInPermanentZone = (() => {
    if (!isContractor) return false;
    let fid = currentFolderId;
    while (fid) {
      const folder = allFiles.find(f => f.id === fid);
      if (!folder) break;
      if (folder.folderLevel === 'zone' && folder.name === '永久區') return true;
      fid = folder.parentId;
    }
    return false;
  })();

  let items = getChildren(currentFolderId);

  // 外包人員在根目錄時，隱藏永久區
  if (isContractor && currentFolderId === null) {
    items = items.filter(i => i.name !== '永久區');
  }

  if (searchQuery) {
    items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-TW');
  });

  const handleOpen = (item: FileItem) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
    } else if (item.mimeType?.includes('markdown') || item.mimeType?.includes('html') || item.name.endsWith('.md')) {
      navigate(`/edit/${item.id}`);
    } else {
      // Preview for all other file types
      setPreviewFile(item);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '預覽', targetName: item.name, targetId: item.id });
    }
  };

  const handleDownload = (item: FileItem) => {
    if (!item.content) { toast.error('此檔案無內容可下載'); return; }
    let blob: Blob;
    if (item.content.startsWith('data:')) {
      const [, base64] = item.content.split(',');
      const binary = atob(base64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      blob = new Blob([arr]);
    } else {
      blob = new Blob([item.content], { type: item.mimeType || 'text/plain' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = item.name; a.click();
    URL.revokeObjectURL(url);
    if (user) addLog({ userId: user.id, userName: user.displayName, action: '下載', targetName: item.name, targetId: item.id });
    toast.success('下載完成');
  };

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<FileItem | null>(null);

  const handleDelete = (item: FileItem) => {
    if (!canWrite) { toast.error('您沒有刪除權限'); return; }
    if (item.isSystem) { toast.error('系統資料夾無法刪除'); return; }
    setDeleteConfirmItem(item);
  };

  const confirmDelete = () => {
    if (!deleteConfirmItem) return;
    moveToTrash(deleteConfirmItem.id, user?.displayName || '未知');
    if (user) addLog({ userId: user.id, userName: user.displayName, action: '刪除', targetName: deleteConfirmItem.name, targetId: deleteConfirmItem.id, details: '移至回收桶' });
    toast.success(`已將「${deleteConfirmItem.name}」移至回收桶`);
    setDeleteConfirmItem(null);
  };

  const handleRename = () => {
    if (!canWrite) { toast.error('您沒有重新命名權限'); return; }
    if (renamingItem?.isSystem) { toast.error('系統資料夾無法重新命名'); return; }
    if (renamingItem && newName.trim()) {
      renameItem(renamingItem.id, newName.trim());
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '重新命名', targetName: renamingItem.name, details: `→ ${newName.trim()}` });
      setRenameDialogOpen(false);
      toast.success('已重新命名');
    }
  };

  if (!canAccess || isInPermanentZone) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Lock className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg">{isInPermanentZone ? '外包人員無法存取永久區' : '您沒有權限存取此資料夾'}</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <Folder className="w-16 h-16 mb-4 opacity-30" />
        <p className="text-lg">此資料夾為空</p>
        <p className="text-sm">使用上方「新增」按鈕來建立檔案或資料夾</p>
      </div>
    );
  }

  const renderItem = (item: FileItem) => {
    const editLock = item.type === 'file' ? getLock(item.id) : undefined;
    const isBeingEdited = !!editLock;

    return (
    <ContextMenu key={item.id}>
      <ContextMenuTrigger>
        {viewMode === 'grid' ? (
          <div
            className="group flex flex-col items-center p-4 rounded-xl border border-border/50 bg-card hover:bg-accent/50 hover:border-primary/30 transition-all cursor-pointer relative"
            onDoubleClick={() => handleOpen(item)}
          >
            {isBeingEdited && (
              <div className="absolute top-2 right-2 flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px] font-medium">
                <UserPen className="w-3 h-3" />
                {editLock.userName}
              </div>
            )}
            {getFileIcon(item)}
            <p className="mt-2 text-sm font-medium text-center truncate w-full">{item.name}</p>
            <p className="text-xs text-muted-foreground">
              {item.type === 'folder' ? (item.isSystem ? '系統資料夾' : '資料夾') : formatSize(item.size)}
            </p>
            {item.isSystem && <Badge variant="outline" className="mt-1 text-[10px]">系統</Badge>}
          </div>
        ) : (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer border-b border-border/30"
            onDoubleClick={() => handleOpen(item)}
          >
            <div className="shrink-0">{getFileIcon(item)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {item.isSystem && <Badge variant="outline" className="text-[10px]">系統</Badge>}
                {isBeingEdited && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    <UserPen className="w-3 h-3" />
                    {editLock.userName} 編輯中
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{item.createdBy}</p>
            </div>
            <div className="text-xs text-muted-foreground w-28 text-right">{formatSize(item.size)}</div>
            <div className="text-xs text-muted-foreground w-40 text-right">{formatDate(item.updatedAt)}</div>
          </div>
        )}
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => handleOpen(item)}>
          <FileText className="w-4 h-4 mr-2" />開啟
        </ContextMenuItem>
        {item.type === 'file' && (
          <>
            <ContextMenuItem onClick={() => { setPreviewFile(item); if (user) addLog({ userId: user.id, userName: user.displayName, action: '預覽', targetName: item.name, targetId: item.id }); }}>
              <Eye className="w-4 h-4 mr-2" />預覽
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleDownload(item)}>
              <Download className="w-4 h-4 mr-2" />下載
            </ContextMenuItem>
          </>
        )}
        {canWrite && !item.isSystem && (
          <>
            <ContextMenuItem onClick={() => { setRenamingItem(item); setNewName(item.name); setRenameDialogOpen(true); }}>
              <Pencil className="w-4 h-4 mr-2" />重新命名
            </ContextMenuItem>
            <ContextMenuItem className="text-destructive" onClick={() => handleDelete(item)}>
              <Trash2 className="w-4 h-4 mr-2" />刪除
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
  };

  return (
    <>
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {items.map(renderItem)}
        </div>
      ) : (
        <div>
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground font-medium border-b">
            <div className="w-10" />
            <div className="flex-1">名稱</div>
            <div className="w-28 text-right">大小</div>
            <div className="w-40 text-right">修改日期</div>
          </div>
          {items.map(renderItem)}
        </div>
      )}

      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>重新命名</DialogTitle></DialogHeader>
          <Input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRename()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>取消</Button>
            <Button onClick={handleRename}>確認</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog file={previewFile} open={!!previewFile} onOpenChange={(open) => { if (!open) setPreviewFile(null); }} />

      {/* 刪除確認對話框 */}
      <Dialog open={!!deleteConfirmItem} onOpenChange={(open) => { if (!open) setDeleteConfirmItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />確認刪除
            </DialogTitle>
            <DialogDescription>
              確定要將「{deleteConfirmItem?.name}」移至回收桶嗎？您可以在 30 天內從回收桶還原。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmItem(null)}>取消</Button>
            <Button variant="destructive" onClick={confirmDelete}>移至回收桶</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FileList;
