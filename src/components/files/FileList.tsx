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
  Folder, FileText, Image, File, Download, Trash2, Pencil, FileCode, Lock, Clock, Archive, UserPen, Eye, AlertTriangle, Share2, Copy,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { FileItem } from '@/types';
import FilePreviewDialog from '@/components/files/FilePreviewDialog';
import shareService from '@/services/shareService';
import fileService from '@/services/fileService';

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

  // 檢查當前是否在時效區下
  const isInTimedZone = (() => {
    let fid = currentFolderId;
    while (fid) {
      const folder = allFiles.find(f => f.id === fid);
      if (!folder) break;
      if (folder.folderLevel === 'zone' && folder.name === '時效區') return true;
      fid = folder.parentId;
    }
    return false;
  })();

  const getDaysLeft = (createdAt: string) => {
    return Math.max(0, 30 - Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000));
  };

  let items = getChildren(currentFolderId);

  // 外包人員在根目錄時，隱藏永久區
  if (isContractor && currentFolderId === null) {
    items = items.filter(i => i.name !== '永久區');
  }

  if (searchQuery) {
    items = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }

  const collator = new Intl.Collator('zh-TW', { numeric: true, sensitivity: 'base' });
  items.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return collator.compare(a.name, b.name);
  });

  const isEditableFile = (item: FileItem) => {
    if (item.type !== 'file') return false;
    const name = item.name.toLowerCase();
    const mime = item.mimeType || '';
    // Markdown, HTML, TXT, CSV, JSON, XML, LOG, INI, YAML 等文字類檔案可編輯
    if (mime.includes('markdown') || mime.includes('html') || name.endsWith('.md')) return true;
    if (mime.startsWith('text/') || /\.(txt|csv|json|xml|log|ini|cfg|yaml|yml)$/i.test(name)) return true;
    return false;
  };

  const handleOpen = (item: FileItem) => {
    if (item.type === 'folder') {
      setCurrentFolderId(item.id);
    } else if (isEditableFile(item)) {
      navigate(`/edit/${item.id}`);
    } else {
      // Preview for all other file types (DOCX, XLSX, PDF, images, etc.)
      setPreviewFile(item);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '預覽', targetName: item.name, targetId: item.id });
    }
  };

  const handleDownload = async (item: FileItem) => {
    if (item.type !== 'file') return;
    try {
      const blob = await fileService.download(item.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '下載', targetName: item.name, targetId: item.id });
      toast.success('下載完成');
    } catch (err) {
      console.error('下載失敗:', err);
      toast.error('下載失敗');
    }
  };

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<FileItem | null>(null);
  const [shareDialog, setShareDialog] = useState<{ open: boolean; url: string; fileName: string }>({ open: false, url: '', fileName: '' });

  const handleDelete = (item: FileItem) => {
    if (!canWrite) { toast.error('您沒有刪除權限'); return; }
    if (item.isSystem) { toast.error('系統資料夾無法刪除'); return; }
    setDeleteConfirmItem(item);
  };

  const handleForceDelete = async (item: FileItem) => {
    if (user?.role !== '系統管理員') { toast.error('僅系統管理員可強制刪除'); return; }
    if (!window.confirm(`確定要強制刪除「${item.name}」嗎？此操作會直接刪除實體與資料庫紀錄，無法還原。`)) return;
    try {
      await fileService.forceDelete(item.id);
      toast.success('已強制刪除');
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '刪除失敗');
    }
  };

  const handleShare = async (item: FileItem) => {
    if (item.type !== 'file') { toast.error('僅能分享檔案'); return; }
    if (user?.role === '外包人員') { toast.error('外包人員無法建立分享連結'); return; }
    try {
      const share = await shareService.create(item.id);
      const url = shareService.buildShareableUrl(share.token);
      setShareDialog({ open: true, url, fileName: item.name });
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '分享', targetName: item.name, targetId: item.id });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || '建立分享連結失敗');
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirmItem) return;
    const deleted = await moveToTrash(deleteConfirmItem.id, user?.displayName || '未知');
    if (!deleted) return;
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
            {isInTimedZone && item.type === 'file' && (
              <Badge variant={getDaysLeft(item.createdAt) <= 7 ? 'destructive' : 'secondary'} className="mt-1 text-[10px]">
                剩 {getDaysLeft(item.createdAt)} 天
              </Badge>
            )}
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
                {isInTimedZone && item.type === 'file' && (
                  <Badge variant={getDaysLeft(item.createdAt) <= 7 ? 'destructive' : 'secondary'} className="text-[10px]">
                    剩 {getDaysLeft(item.createdAt)} 天
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
            {user?.role !== '外包人員' && (
              <ContextMenuItem onClick={() => handleShare(item)}>
                <Share2 className="w-4 h-4 mr-2" />建立公開分享連結
              </ContextMenuItem>
            )}
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
        {user?.role === '系統管理員' && item.type === 'folder' && (
          <ContextMenuItem className="text-destructive" onClick={() => handleForceDelete(item)}>
            <AlertTriangle className="w-4 h-4 mr-2" />強制刪除（清除殘留）
          </ContextMenuItem>
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
      {/* 分享連結 Dialog */}
      <Dialog open={shareDialog.open} onOpenChange={(open) => setShareDialog(s => ({ ...s, open }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="w-5 h-5 text-primary" />公開分享連結已建立
            </DialogTitle>
            <DialogDescription>
              將下方連結傳給對方，未登入也能下載「{shareDialog.fileName}」。可在系統管理頁撤銷。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Input value={shareDialog.url} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
            <Button
              variant="outline"
              onClick={() => {
                navigator.clipboard.writeText(shareDialog.url);
                toast.success('已複製連結');
              }}
            >
              <Copy className="w-4 h-4 mr-1" />複製
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setShareDialog(s => ({ ...s, open: false }))}>關閉</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FileList;
