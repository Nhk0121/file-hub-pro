import { useParams, useNavigate } from 'react-router-dom';
import { useFiles } from '@/contexts/FileContext';
import { useEditLock } from '@/contexts/EditLockContext';
import { useAudit } from '@/contexts/AuditContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Editor = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const { getFile, updateFileContent } = useFiles();
  const { acquireLock, releaseLock, getLock } = useEditLock();
  const { addLog } = useAudit();
  const { user } = useAuth();
  const file = fileId ? getFile(fileId) : undefined;
  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [locked, setLocked] = useState(false);

  // Acquire lock on mount, release on unmount
  useEffect(() => {
    if (fileId) {
      const got = acquireLock(fileId);
      setLocked(!got);
    }
    return () => {
      if (fileId) releaseLock(fileId);
    };
  }, [fileId]);

  useEffect(() => {
    if (file) {
      setContent(file.content || '');
      setHasChanges(false);
    }
  }, [file?.id]);

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground">找不到此檔案</p>
        <Button variant="link" onClick={() => navigate('/')}>返回檔案列表</Button>
      </div>
    );
  }

  const isMarkdown = file.mimeType?.includes('markdown') || file.name.endsWith('.md');

  const handleSave = () => {
    updateFileContent(file.id, content);
    setHasChanges(false);
    if (user) {
      addLog({ userId: user.id, userName: user.displayName, action: '編輯', targetName: file.name, targetId: file.id });
    }
    toast.success('文件已儲存');
  };

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    setHasChanges(true);
  };

  const lockInfo = fileId ? getLock(fileId) : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{file.name}</h2>
            <p className="text-xs text-muted-foreground">
              {isMarkdown ? 'Markdown 編輯器' : '富文字編輯器'}
              {hasChanges && ' • 未儲存的變更'}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || locked}>
          <Save className="w-4 h-4 mr-2" />
          儲存
        </Button>
      </div>

      {/* Lock warning */}
      {locked && lockInfo && (
        <Alert variant="destructive" className="mx-6 mt-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            此文件正由 <strong>{lockInfo.userName}</strong> 編輯中，目前為唯讀模式。
          </AlertDescription>
        </Alert>
      )}

      {/* Editor */}
      <div className="flex-1 p-6 overflow-auto">
        {locked ? (
          <div className="border rounded-lg bg-card p-6 min-h-[400px] opacity-70 pointer-events-none select-none">
            {isMarkdown ? (
              <pre className="whitespace-pre-wrap font-mono text-sm">{content}</pre>
            ) : (
              <div dangerouslySetInnerHTML={{ __html: content }} />
            )}
          </div>
        ) : isMarkdown ? (
          <MarkdownEditor content={content} onChange={handleContentChange} />
        ) : (
          <RichTextEditor content={content} onChange={handleContentChange} />
        )}
      </div>
    </div>
  );
};

export default Editor;
