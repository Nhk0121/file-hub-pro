import { useParams, useNavigate } from 'react-router-dom';
import { useFiles } from '@/contexts/FileContext';
import { useEditLock } from '@/contexts/EditLockContext';
import { useAudit } from '@/contexts/AuditContext';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import RichTextEditor from '@/components/editor/RichTextEditor';
import MarkdownEditor from '@/components/editor/MarkdownEditor';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Save, Lock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import fileService from '@/services/fileService';

const Editor = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const { getFile, updateFileContent } = useFiles();
  const { acquireLock, releaseLock, getLock } = useEditLock();
  const { addLog } = useAudit();
  const { user } = useAuth();
  const file = fileId ? getFile(fileId) : undefined;

  const name = (file?.name ?? '').toLowerCase();
  const mime = file?.mimeType || '';
  const isMarkdown = mime.includes('markdown') || name.endsWith('.md');
  const isHtml = mime.includes('html') || name.endsWith('.html') || name.endsWith('.htm');
  const isPlainText = !!file && !isMarkdown && !isHtml;

  const [content, setContent] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [locked, setLocked] = useState(false);
  const [loadingContent, setLoadingContent] = useState(true);

  useEffect(() => {
    if (!fileId) return;
    const got = acquireLock(fileId);
    setLocked(!got);
    return () => { releaseLock(fileId); };
  }, [fileId]);

  useEffect(() => {
    if (!file) {
      setLoadingContent(false);
      return;
    }
    let cancelled = false;
    setLoadingContent(true);
    fileService.download(file.id)
      .then(blob => blob.text())
      .then(text => {
        if (!cancelled) {
          setContent(text);
          setHasChanges(false);
        }
      })
      .catch(err => {
        console.error('載入檔案內容失敗:', err);
        if (!cancelled) toast.error('無法載入檔案內容');
      })
      .finally(() => { if (!cancelled) setLoadingContent(false); });
    return () => { cancelled = true; };
  }, [file?.id]);

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-muted-foreground">找不到此檔案</p>
        <Button variant="link" onClick={() => navigate('/')}>返回檔案列表</Button>
      </div>
    );
  }

  const editorTypeLabel = isMarkdown ? 'Markdown 編輯器'
    : isHtml ? '富文字編輯器'
    : '純文字編輯器';

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
      <div className="flex items-center justify-between px-6 py-3 border-b bg-card">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">{file.name}</h2>
            <p className="text-xs text-muted-foreground">
              {editorTypeLabel}
              {hasChanges && ' • 未儲存的變更'}
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || locked || loadingContent}>
          <Save className="w-4 h-4 mr-2" />
          儲存
        </Button>
      </div>

      {locked && lockInfo && (
        <Alert variant="destructive" className="mx-6 mt-4">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            此文件正由 <strong>{lockInfo.userName}</strong> 編輯中,目前為唯讀模式。
          </AlertDescription>
        </Alert>
      )}

      <div className="flex-1 flex flex-col overflow-auto">
        {loadingContent ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : locked ? (
          <div className="m-6 border rounded-lg bg-card p-6 min-h-[400px] opacity-70 pointer-events-none select-none">
            <pre className="whitespace-pre-wrap font-mono text-sm">{content}</pre>
          </div>
        ) : isMarkdown ? (
          <div className="p-6"><MarkdownEditor content={content} onChange={handleContentChange} /></div>
        ) : isHtml ? (
          <div className="p-6"><RichTextEditor content={content} onChange={handleContentChange} /></div>
        ) : isPlainText ? (
          <div className="p-6">
            <textarea
              value={content}
              onChange={e => handleContentChange(e.target.value)}
              className="w-full min-h-[400px] p-4 bg-card border rounded-lg font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="在此編輯文件內容..."
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Editor;
