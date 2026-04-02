import { useState } from 'react';
import { useFiles } from '@/contexts/FileContext';
import FileToolbar from '@/components/files/FileToolbar';
import FileList from '@/components/files/FileList';
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { FolderOpen, FileText } from 'lucide-react';
import React from 'react';

const Index = () => {
  const { currentFolderId, setCurrentFolderId, getBreadcrumbs, files } = useFiles();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const breadcrumbs = getBreadcrumbs(currentFolderId);

  const totalFiles = files.filter(f => f.type === 'file').length;
  const totalFolders = files.filter(f => f.type === 'folder').length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b bg-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">檔案管理</h1>
            <p className="text-sm text-muted-foreground mt-1">管理您的文件、資料夾與檔案</p>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><FolderOpen className="w-4 h-4" />{totalFolders} 個資料夾</span>
            <span className="flex items-center gap-1"><FileText className="w-4 h-4" />{totalFiles} 個檔案</span>
          </div>
        </div>

        {/* Breadcrumbs */}
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => (
              <React.Fragment key={crumb.id ?? 'root'}>
                {i > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {i === breadcrumbs.length - 1 ? (
                    <BreadcrumbPage>{crumb.name}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink className="cursor-pointer" onClick={() => setCurrentFolderId(crumb.id)}>
                      {crumb.name}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b">
        <FileToolbar viewMode={viewMode} onViewModeChange={setViewMode} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      </div>

      {/* File list */}
      <div className="flex-1 p-6 overflow-auto">
        <FileList viewMode={viewMode} searchQuery={searchQuery} />
      </div>
    </div>
  );
};

export default Index;
