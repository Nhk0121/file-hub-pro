import { useAuth } from '@/contexts/AuthContext';
import { useFiles } from '@/contexts/FileContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  FileText, FolderOpen, Home, LogOut, ChevronRight, ChevronDown, Settings, User,
} from 'lucide-react';
import { useState } from 'react';
import type { FileItem } from '@/types';

const FolderTree = ({
  files,
  parentId,
  level,
  onSelect,
  currentFolderId,
}: {
  files: FileItem[];
  parentId: string | null;
  level: number;
  onSelect: (id: string | null) => void;
  currentFolderId: string | null;
}) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const folders = files.filter(f => f.type === 'folder' && f.parentId === parentId);

  if (folders.length === 0) return null;

  return (
    <div>
      {folders.map(folder => {
        const isExpanded = expanded[folder.id];
        const isActive = currentFolderId === folder.id;
        const hasChildren = files.some(f => f.type === 'folder' && f.parentId === folder.id);

        return (
          <div key={folder.id}>
            <button
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors
                ${isActive ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
              style={{ paddingLeft: `${12 + level * 16}px` }}
              onClick={() => onSelect(folder.id)}
            >
              {hasChildren ? (
                <button
                  onClick={e => { e.stopPropagation(); setExpanded(prev => ({ ...prev, [folder.id]: !prev[folder.id] })); }}
                  className="p-0.5 hover:bg-sidebar-accent rounded"
                >
                  {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              ) : (
                <span className="w-4" />
              )}
              <FolderOpen className="w-4 h-4 text-sidebar-primary shrink-0" />
              <span className="truncate">{folder.name}</span>
            </button>
            {isExpanded && (
              <FolderTree files={files} parentId={folder.id} level={level + 1} onSelect={onSelect} currentFolderId={currentFolderId} />
            )}
          </div>
        );
      })}
    </div>
  );
};

const AppSidebar = () => {
  const { user, logout } = useAuth();
  const { files, currentFolderId, setCurrentFolderId } = useFiles();
  const navigate = useNavigate();
  const location = useLocation();

  const handleFolderSelect = (id: string | null) => {
    setCurrentFolderId(id);
    if (location.pathname !== '/') navigate('/');
  };

  return (
    <div className="w-64 h-screen bg-sidebar-background text-sidebar-foreground flex flex-col border-r border-sidebar-border">
      {/* Logo */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 bg-sidebar-primary rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5 text-sidebar-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-sidebar-foreground">文件管理系統</h1>
          <p className="text-xs text-sidebar-muted">DMS v1.0</p>
        </div>
      </div>

      <Separator className="bg-sidebar-border" />

      {/* Navigation */}
      <div className="p-2">
        <button
          onClick={() => handleFolderSelect(null)}
          className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors
            ${currentFolderId === null && location.pathname === '/' ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/50'}`}
        >
          <Home className="w-4 h-4" />
          <span>所有檔案</span>
        </button>
      </div>

      <Separator className="bg-sidebar-border mx-2" />

      {/* Folder tree */}
      <div className="px-2 pt-2">
        <p className="text-xs text-sidebar-muted px-3 mb-1 font-medium">資料夾</p>
      </div>
      <ScrollArea className="flex-1 px-2">
        <FolderTree files={files} parentId={null} level={0} onSelect={handleFolderSelect} currentFolderId={currentFolderId} />
      </ScrollArea>

      <Separator className="bg-sidebar-border" />

      {/* User info */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-sidebar-accent rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.displayName}</p>
            <p className="text-xs text-sidebar-muted">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => { logout(); navigate('/login'); }}
        >
          <LogOut className="w-4 h-4 mr-2" />
          登出
        </Button>
      </div>
    </div>
  );
};

export default AppSidebar;
