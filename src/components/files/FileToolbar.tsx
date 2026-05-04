import { useState, useRef, useCallback } from 'react';
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
import { FolderPlus, FilePlus, Upload, FolderUp, Plus, Search, LayoutGrid, List, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { scanPII, isExecutableFile } from '@/lib/piiChecker';
import {
  extractFilesFromInput,
  generateUniqueName, renameFile,
  groupByPath,
  DEFAULT_MAX_FOLDER_DEPTH,
} from '@/lib/folderUpload';
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

  // PII 警告彈窗（資料夾批次）
  type BatchPiiItem = {
    file: File;
    parentId: string | null;
    relativePath: string;
    matches: { type: string; sample: string }[];
  };
  const [batchPiiOpen, setBatchPiiOpen] = useState(false);
  const [batchPiiItems, setBatchPiiItems] = useState<BatchPiiItem[]>([]);

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

  // 上傳整個資料夾（最多 3 層子資料夾，超過會略過）
  const handleUploadFolder = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.setAttribute('webkitdirectory', '');
    input.setAttribute('directory', '');
    input.onchange = async (e) => {
      const fl = (e.target as HTMLInputElement).files;
      const { files: picked, rejectedDeepFiles } = extractFilesFromInput(fl, DEFAULT_MAX_FOLDER_DEPTH);
      if (picked.length === 0 && rejectedDeepFiles.length === 0) return;

      // 1) 依路徑分組，先建立所需的子資料夾（DFS / 由淺到深）
      //    folderIdMap: pathKey ("a/b/c") -> 在 DMS 中的 folderId（根目錄為空字串 key）
      const folderIdMap = new Map<string, string | null>();
      folderIdMap.set('', currentFolderId);

      // 蒐集所有需要存在的資料夾路徑
      const allPaths = new Set<string>();
      for (const it of picked) {
        const segs = it.relativePath;
        for (let i = 1; i <= segs.length; i++) {
          allPaths.add(segs.slice(0, i).join('/'));
        }
      }
      // 依深度排序
      const sortedPaths = Array.from(allPaths).sort((a, b) => a.split('/').length - b.split('/').length);

      let folderCreateFailed = 0;
      for (const pathKey of sortedPaths) {
        const segs = pathKey.split('/');
        const folderName = segs[segs.length - 1];
        const parentKey = segs.slice(0, -1).join('/');
        const parentId = folderIdMap.get(parentKey) ?? null;

        // 若無權建子資料夾，則略過
        if (!canCreateSubfolder(parentId)) {
          folderCreateFailed++;
          continue;
        }
        try {
          const created = await addFolder(folderName, parentId);
          if (created) {
            folderIdMap.set(pathKey, created.id);
          } else {
            folderCreateFailed++;
          }
        } catch {
          folderCreateFailed++;
        }
      }

      // 2) 依目標資料夾分組，分別處理檔名重複
      const grouped = groupByPath(picked);
      const renamedQueue: { file: File; parentId: string | null }[] = [];

      grouped.forEach((items, pathKey) => {
        const targetParentId = folderIdMap.get(pathKey);
        if (targetParentId === undefined) return; // 上層資料夾建立失敗
        const existing = new Set<string>(
          allFiles
            .filter(x => x.type === 'file' && x.parentId === targetParentId)
            .map(x => x.name),
        );
        for (const it of items) {
          const newName = generateUniqueName(it.file.name, existing);
          existing.add(newName);
          renamedQueue.push({ file: renameFile(it.file, newName), parentId: targetParentId });
        }
      });

      // 3) 預先處理：執行檔自動略過 + PII 預掃，分流為 cleanQueue / piiItems
      const cleanQueue: { file: File; parentId: string | null }[] = [];
      const piiItems: BatchPiiItem[] = [];
      let skippedExe = 0;

      for (const item of renamedQueue) {
        const f = item.file;
        if (isExecutableFile(f.name) && user?.role !== '系統管理員') {
          skippedExe++;
          continue;
        }
        const isTextLike = f.type.startsWith('text/') || /\.(md|markdown|json|csv|xml|log|ini|ya?ml|html?|txt)$/i.test(f.name);
        let matches: { type: string; sample: string }[] = [];
        if (isTextLike) {
          try {
            const text = await f.text();
            matches = scanPII(text);
          } catch { /* ignore */ }
        }
        if (matches.length > 0) {
          // 計算顯示用相對路徑（找回原始 webkitRelativePath；若已被 renameFile 替換則用名稱）
          const original = picked.find(p => p.file.name === f.name || (p.file as unknown as { webkitRelativePath?: string }).webkitRelativePath?.endsWith('/' + f.name));
          const relPath = original
            ? [...original.relativePath, f.name].join('/')
            : f.name;
          piiItems.push({ file: f, parentId: item.parentId, relativePath: relPath, matches });
        } else {
          cleanQueue.push(item);
        }
      }

      const skippedByPerm = picked.length - renamedQueue.length;
      const msgs: string[] = [`掃描完成：共 ${renamedQueue.length} 個檔案`];
      if (rejectedDeepFiles.length > 0) msgs.push(`已略過 ${rejectedDeepFiles.length} 個超過 ${DEFAULT_MAX_FOLDER_DEPTH} 層深度`);
      if (folderCreateFailed > 0) msgs.push(`${folderCreateFailed} 個子資料夾建立失敗`);
      if (skippedByPerm > 0) msgs.push(`${skippedByPerm} 個因權限略過`);
      if (skippedExe > 0) msgs.push(`${skippedExe} 個執行檔已略過`);
      if (piiItems.length > 0) msgs.push(`${piiItems.length} 個檔案疑含個資，待您確認`);
      toast.info(msgs.join('；'));

      // 4a) 先把無 PII 的檔案上傳
      for (const item of cleanQueue) {
        const created = await uploadFile(item.file, item.parentId);
        if (created && user) {
          addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: item.file.name });
        }
      }

      // 4b) 若有 PII 檔案 → 開啟彙總彈窗讓使用者一次決定
      if (piiItems.length > 0) {
        setBatchCleanQueue([]); // cleanQueue 已上傳完，這裡只用來給彈窗 callback 區隔；保留欄位以利後續擴充
        setBatchPiiItems(piiItems);
        setBatchPiiOpen(true);
      }
    };
    input.click();
  };

  // 批次 PII：使用者選擇全部上傳
  const handleConfirmBatchPii = async () => {
    const items = batchPiiItems;
    setBatchPiiOpen(false);
    setBatchPiiItems([]);
    if (items.length === 0) return;

    let ok = 0;
    for (const it of items) {
      const created = await uploadFile(it.file, it.parentId);
      if (created && user) {
        addLog({ userId: user.id, userName: user.displayName, action: '上傳', targetName: it.file.name });
        addLog({
          userId: user.id, userName: user.displayName,
          action: '個資存取', targetName: it.file.name,
          details: `偵測到個資: ${it.matches.map(m => m.type).join(', ')}`,
        });
        ok++;
      }
    }
    toast.warning(`已上傳 ${ok} 個含個資檔案，已寫入稽核日誌`);
  };

  // 批次 PII：使用者選擇全部略過
  const handleCancelBatchPii = () => {
    const count = batchPiiItems.length;
    if (user && count > 0) {
      addLog({
        userId: user.id, userName: user.displayName,
        action: '個資存取', targetName: `批次上傳取消 (${count} 個檔案)`,
        details: `使用者選擇略過含個資檔案：${batchPiiItems.map(i => i.relativePath).join('；')}`,
      });
    }
    setBatchPiiOpen(false);
    setBatchPiiItems([]);
    toast.info(`已略過 ${count} 個含個資檔案`);
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
              <DropdownMenuItem onClick={handleUploadFolder}>
                <FolderUp className="w-4 h-4 mr-2" />上傳整個資料夾
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

      {/* 批次 PII 彙總彈窗（資料夾上傳用） */}
      <Dialog open={batchPiiOpen} onOpenChange={(o) => { if (!o) handleCancelBatchPii(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />批次上傳：個資風險彙總
            </DialogTitle>
            <DialogDescription>
              系統在本次資料夾上傳中偵測到 <span className="font-semibold text-destructive">{batchPiiItems.length}</span> 個檔案疑似包含個人資料，請選擇處置方式。
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto border rounded-md p-3 space-y-2 bg-muted/30">
            {batchPiiItems.map((it, idx) => (
              <div key={idx} className="text-sm border-b last:border-b-0 pb-2 last:pb-0">
                <div className="font-medium break-all">{it.relativePath}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {it.matches.map((m, i) => (
                    <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-destructive/10 text-destructive">
                      <AlertTriangle className="w-3 h-3" />{m.type}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            ※「全部上傳」會把上述檔案一併上傳並寫入稽核日誌；「全部略過」則僅記錄略過事件，檔案不會上傳。其他無個資的檔案已上傳完成。
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancelBatchPii}>全部略過</Button>
            <Button variant="destructive" onClick={handleConfirmBatchPii}>全部上傳並記錄</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>

  );
};

export default FileToolbar;
