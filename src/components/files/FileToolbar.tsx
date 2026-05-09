import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFiles } from '@/contexts/FileContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { FolderPlus, FilePlus, Upload, Plus, Search, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { scanPII, isExecutableFile } from '@/lib/piiChecker';
import type { FileItem } from '@/types';

interface FileToolbarProps {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

// 取得目前資料夾所屬的組別名稱
function getDepartmentFromFolder(folderId: string | null, allFiles: FileItem[]): string | null {
  let fid = folderId;
  while (fid) {
    const folder = allFiles.find(f => f.id === fid);
    if (!folder) break;
    if (folder.folderLevel === 'department') return folder.name;
    fid = folder.parentId;
  }
  return null;
}

// 檢查是否在 zone 層級底下
function isInsideZone(folderId: string | null, allFiles: FileItem[]): boolean {
  let fid = folderId;
  while (fid) {
    const folder = allFiles.find(f => f.id === fid);
    if (!folder) break;
    if (folder.folderLevel === 'zone') return true;
    fid = folder.parentId;
  }
  return false;
}

// 取得目前資料夾所屬的區域名稱（時效區 or 永久區）
function getZoneNameFromFolder(folderId: string | null, allFiles: FileItem[]): string | null {
  let fid = folderId;
  while (fid) {
    const folder = allFiles.find(f => f.id === fid);
    if (!folder) break;
    if (folder.folderLevel === 'zone') return folder.name;
    fid = folder.parentId;
  }
  return null;
}

const FileToolbar = ({ viewMode, onViewModeChange, searchQuery, onSearchChange }: FileToolbarProps) => {
  const { currentFolderId, addFolder, addFile, uploadFile, createTextFile, canCreateSubfolder, files: allFiles } = useFiles();
  const { user } = useAuth();
  const { addLog } = useAudit();
  const { getFolderPermission, getUserPermanentDepts } = usePermissions();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<'markdown' | 'richtext'>('markdown');

  // PII 警告彈窗（單檔）
  const [piiWarningOpen, setPiiWarningOpen] = useState(false);
  const [piiMatches, setPiiMatches] = useState<{ type: string; sample: string }[]>([]);
  const [pendingPiiFile, setPendingPiiFile] = useState<FileItem | null>(null);

  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  // 跨組別上傳管控：僅永久區限制，時效區不限制
  const departmentOfFolder = getDepartmentFromFolder(currentFolderId, allFiles);
  const insideZone = isInsideZone(currentFolderId, allFiles);
  const zoneName = getZoneNameFromFolder(currentFolderId, allFiles);
  const isInPermanentZone = zoneName === '永久區';

  const canUploadToDept = (() => {
    if (isAdmin) return true;
    if (!insideZone || !departmentOfFolder) return true;
    // 時效區不限制跨組別上傳
    if (!isInPermanentZone) return true;
    if (!user) return false;
    // 永久區：僅自己的組別或有授權
    if (user.department === departmentOfFolder) return true;
    const overrideDepts = getUserPermanentDepts(user.id);
    if (overrideDepts.includes(departmentOfFolder)) return true;
    return false;
  })();

  const canWrite = !currentFolderId || !user || isAdmin
    ? true
    : (getFolderPermission(currentFolderId, user.id) === '完整權限' && canUploadToDept);

  const canAddFolder = canWrite && canCreateSubfolder(currentFolderId);

  const handleCreateFolder = async () => {
    if (newFolderName.trim()) {
      const folderName = newFolderName.trim();
      const created = await addFolder(folderName, currentFolderId);
      if (!created) return;
      toast.success(`已建立資料夾:${folderName}`);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '建立資料夾', targetName: folderName });
      setNewFolderName('');
      setFolderDialogOpen(false);
    }
  };

  const handleCreateDoc = async () => {
    if (!newDocName.trim()) return;
    const ext = newDocType === 'markdown' ? '.md' : '.html';
    const name = newDocName.trim().endsWith(ext) ? newDocName.trim() : newDocName.trim() + ext;
    const content = newDocType === 'markdown' ? '# 新文件\n\n開始編輯...' : '<p>開始編輯...</p>';
    const mime = newDocType === 'markdown' ? 'text/markdown' : 'text/html';

    // PII 掃描
    const matches = scanPII(content);
    if (matches.length > 0) {
      // 仍走 PII 確認流程，記錄到 pendingPiiFile（用最少欄位）
      setPiiMatches(matches);
      setPendingPiiFile({
        id: 'pending', name, type: 'file', mimeType: mime, size: content.length,
        parentId: currentFolderId, createdAt: '', updatedAt: '', createdBy: user?.displayName ?? '',
        content,
      } as FileItem);
      setPiiWarningOpen(true);
    } else {
      const created = await createTextFile(name, content, mime, currentFolderId);
      if (created && user) {
        addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: name });
      }
    }
    setNewDocName('');
    setDocDialogOpen(false);
  };

  const handleConfirmPiiUpload = async () => {
    if (pendingPiiFile) {
      const mime = pendingPiiFile.mimeType ?? 'text/plain';
      const created = await createTextFile(
        pendingPiiFile.name,
        pendingPiiFile.content ?? '',
        mime,
        pendingPiiFile.parentId,
      );
      if (created && user) {
        addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: pendingPiiFile.name });
        addLog({ userId: user.id, userName: user.displayName, action: '個資存取', targetName: pendingPiiFile.name, details: `偵測到個資: ${piiMatches.map(m => m.type).join(', ')}` });
        toast.warning('檔案已上傳，但已記錄個資存取事件');
      }
    }
    setPiiWarningOpen(false);
    setPendingPiiFile(null);
    setPiiMatches([]);
  };

  const handleCancelPiiUpload = () => {
    setPiiWarningOpen(false);
    setPendingPiiFile(null);
    setPiiMatches([]);
    toast.info('已取消上傳');
  };

  const processFileForUpload = async (f: File) => {
    if (isExecutableFile(f.name) && user?.role !== '系統管理員') {
      toast.error(`「${f.name}」為執行檔,僅系統管理員可上傳`);
      return;
    }
    const isTextLike = f.type.startsWith('text/') || /\.(md|markdown|json|csv|xml|log|ini|ya?ml|html?|txt)$/i.test(f.name);
    if (isTextLike) {
      try {
        const text = await f.text();
        const matches = scanPII(text);
        if (matches.length > 0) {
          setPiiMatches(matches);
          setPendingPiiFile({
            id: 'pending', name: f.name, type: 'file', mimeType: f.type, size: f.size,
            parentId: currentFolderId, createdAt: '', updatedAt: '',
            createdBy: user?.displayName ?? '', content: text,
          } as FileItem);
          setPiiWarningOpen(true);
          return;
        }
      } catch { /* ignore */ }
    }
    const created = await uploadFile(f, currentFolderId);
    if (created) {
      toast.success(`已上傳:${f.name}`);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: f.name });
    }
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      for (const f of Array.from(files)) await processFileForUpload(f);
    };
    input.click();
  };

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder="搜尋檔案..." className="pl-9" />
        </div>

        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onViewModeChange('grid')}>
            <LayoutGrid className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-8 w-8" onClick={() => onViewModeChange('list')}>
            <List className="w-4 h-4" />
          </Button>
        </div>

        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />新增</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canAddFolder && (
                <DropdownMenuItem onClick={() => setFolderDialogOpen(true)}>
                  <FolderPlus className="w-4 h-4 mr-2" />新增資料夾
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { setNewDocType('markdown'); setDocDialogOpen(true); }}>
                <FilePlus className="w-4 h-4 mr-2" />新增 Markdown 文件
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setNewDocType('richtext'); setDocDialogOpen(true); }}>
                <FilePlus className="w-4 h-4 mr-2" />新增富文字文件
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleUpload}>
                <Upload className="w-4 h-4 mr-2" />上傳檔案
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {!canWrite && insideZone && isInPermanentZone && departmentOfFolder && !isAdmin && (
          <span className="text-xs text-destructive">您無法在永久區「{departmentOfFolder}」上傳檔案</span>
        )}
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增資料夾</DialogTitle>
            <DialogDescription>建立後會同步寫入資料庫與目前選取的資料夾位置。</DialogDescription>
          </DialogHeader>
          <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="資料夾名稱" onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateFolder}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增{newDocType === 'markdown' ? 'Markdown' : '富文字'}文件</DialogTitle>
            <DialogDescription>建立後會儲存在目前選取的資料夾中。</DialogDescription>
          </DialogHeader>
          <Input value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="文件名稱" onKeyDown={e => e.key === 'Enter' && handleCreateDoc()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateDoc}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 個資警告彈窗 */}
      <Dialog open={piiWarningOpen} onOpenChange={setPiiWarningOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />個資風險警告
            </DialogTitle>
            <DialogDescription>
              系統偵測到上傳的檔案可能包含個人資料，請確認是否繼續上傳。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <p className="text-sm font-medium">偵測到以下個資類型：</p>
            <ul className="space-y-1">
              {piiMatches.map((m, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span className="font-medium">{m.type}</span>
                  <span className="text-muted-foreground">（如：{m.sample}）</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground mt-3">
              ※ 若繼續上傳，此操作將被記錄至稽核日誌。請確保符合個資法及公司資安規範。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelPiiUpload}>取消上傳</Button>
            <Button variant="destructive" onClick={handleConfirmPiiUpload}>確認上傳</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>

  );
};

export default FileToolbar;
