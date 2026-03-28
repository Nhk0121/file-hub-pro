import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useFiles } from '@/contexts/FileContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAudit } from '@/contexts/AuditContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { FolderPlus, FilePlus, Upload, Plus, Search, LayoutGrid, List } from 'lucide-react';
import type { FileItem } from '@/types';

interface FileToolbarProps {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

const FileToolbar = ({ viewMode, onViewModeChange, searchQuery, onSearchChange }: FileToolbarProps) => {
  const { currentFolderId, addFolder, addFile } = useFiles();
  const { user } = useAuth();
  const { addLog } = useAudit();
  const { getFolderPermission } = usePermissions();
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [docDialogOpen, setDocDialogOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState<'markdown' | 'richtext'>('markdown');

  const canWrite = !currentFolderId || !user || user.role === '管理員'
    ? true
    : getFolderPermission(currentFolderId, user.id) === '完整權限';

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
        content: newDocType === 'markdown' ? '# 新文件\n\n開始編輯...' : '<p>開始編輯...</p>',
      };
      addFile(file);
      if (user) addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: name });
      setNewDocName('');
      setDocDialogOpen(false);
    }
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;
      Array.from(files).forEach(f => {
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
          <Input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="搜尋檔案..."
            className="pl-9"
          />
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
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                新增
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setFolderDialogOpen(true)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                新增資料夾
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setNewDocType('markdown'); setDocDialogOpen(true); }}>
                <FilePlus className="w-4 h-4 mr-2" />
                新增 Markdown 文件
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setNewDocType('richtext'); setDocDialogOpen(true); }}>
                <FilePlus className="w-4 h-4 mr-2" />
                新增富文字文件
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleUpload}>
                <Upload className="w-4 h-4 mr-2" />
                上傳檔案
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Create folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增資料夾</DialogTitle>
          </DialogHeader>
          <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} placeholder="資料夾名稱" onKeyDown={e => e.key === 'Enter' && handleCreateFolder()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateFolder}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create document dialog */}
      <Dialog open={docDialogOpen} onOpenChange={setDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增{newDocType === 'markdown' ? 'Markdown' : '富文字'}文件</DialogTitle>
          </DialogHeader>
          <Input value={newDocName} onChange={e => setNewDocName(e.target.value)} placeholder="文件名稱" onKeyDown={e => e.key === 'Enter' && handleCreateDoc()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDocDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateDoc}>建立</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FileToolbar;
