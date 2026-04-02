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

const FileToolbar = ({ viewMode, onViewModeChange, searchQuery, onSearchChange }: FileToolbarProps) => {
  const { currentFolderId, addFolder, addFile, canCreateSubfolder } = useFiles();
  const { user } = useAuth();
  const { addLog } = useAudit();
  const { getFolderPermission } = usePermissions();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<'markdown' | 'richtext'>('markdown');

  // PII 警告彈窗
  const [piiWarningOpen, setPiiWarningOpen] = useState(false);
  const [piiMatches, setPiiMatches] = useState<{ type: string; sample: string }[]>([]);
  const [pendingPiiFile, setPendingPiiFile] = useState<FileItem | null>(null);

  const isAdmin = user?.role === '管理員' || user?.role === '系統管理員';

  const canWrite = !currentFolderId || !user || isAdmin
    ? true
    : getFolderPermission(currentFolderId, user.id) === '完整權限';

  const canAddFolder = canWrite && canCreateSubfolder(currentFolderId);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      addFolder(newFolderName.trim(), currentFolderId);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '建立資料夾', targetName: newFolderName.trim() });
      setNewFolderName('');
      setFolderDialogOpen(false);
    }
  };

  const handleCreateDoc = () => {
    if (newDocName.trim()) {
      const ext = newDocType === 'markdown' ? '.md' : '.html';
      const name = newDocName.trim().endsWith(ext) ? newDocName.trim() : newDocName.trim() + ext;
      const content = newDocType === 'markdown' ? '# 新文件\n\n開始編輯...' : '<p>開始編輯...</p>';

      // 檢查個資
      const matches = scanPII(content);
      const file: FileItem = {
        id: crypto.randomUUID(),
        name,
        type: 'file',
        mimeType: newDocType === 'markdown' ? 'text/markdown' : 'text/html',
        size: 0,
        parentId: currentFolderId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.displayName ?? '目前使用者',
        content,
      };

      if (matches.length > 0) {
        setPiiMatches(matches);
        setPendingPiiFile(file);
        setPiiWarningOpen(true);
      } else {
        addFile(file);
        if (user) addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: name });
      }
      setNewDocName('');
      setDocDialogOpen(false);
    }
  };

  const handleConfirmPiiUpload = () => {
    if (pendingPiiFile) {
      addFile(pendingPiiFile);
      if (user) {
        addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: pendingPiiFile.name });
        addLog({ userId: user.id, userName: user.displayName, action: '個資存取', targetName: pendingPiiFile.name, details: `偵測到個資: ${piiMatches.map(m => m.type).join(', ')}` });
      }
      toast.warning('檔案已上傳，但已記錄個資存取事件');
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

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      Array.from(files).forEach(f => {
        // 執行檔限制：僅系統管理員可上傳
        if (isExecutableFile(f.name) && user?.role !== '系統管理員') {
          toast.error(`「${f.name}」為執行檔，僅系統管理員可上傳`);
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const item: FileItem = {
            id: crypto.randomUUID(),
            name: f.name,
            type: 'file',
            mimeType: f.type,
            size: f.size,
            parentId: currentFolderId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            createdBy: user?.displayName ?? '目前使用者',
            content: typeof reader.result === 'string' ? reader.result : undefined,
          };

          // 文字類型檔案掃描個資
          if (typeof reader.result === 'string' && !reader.result.startsWith('data:')) {
            const matches = scanPII(reader.result);
            if (matches.length > 0) {
              setPiiMatches(matches);
              setPendingPiiFile(item);
              setPiiWarningOpen(true);
              return;
            }
          }

          addFile(item);
          if (user) addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: f.name });
        };
        if (f.type.startsWith('text/') || f.name.endsWith('.md') || f.name.endsWith('.json')) {
          reader.readAsText(f);
        } else {
          reader.readAsDataURL(f);
        }
      });
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
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增資料夾</DialogTitle></DialogHeader>
          <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="資料夾名稱" onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateFolder}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增{newDocType === 'markdown' ? 'Markdown' : '富文字'}文件</DialogTitle></DialogHeader>
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
