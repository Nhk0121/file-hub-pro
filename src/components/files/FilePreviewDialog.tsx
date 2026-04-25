import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ZoomIn, ZoomOut, RotateCw, Pencil, FileWarning, Loader2 } from 'lucide-react';
import type { FileItem } from '@/types';
import ReactMarkdown from 'react-markdown';
import fileService from '@/services/fileService';
import { toast } from 'sonner';

interface FilePreviewDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FilePreviewDialog = ({ file, open, onOpenChange }: FilePreviewDialogProps) => {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const name = file?.name.toLowerCase() ?? '';
  const mime = file?.mimeType ?? '';
  const isImage = mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(name);
  const isPdf = mime === 'application/pdf' || name.endsWith('.pdf');
  const isMarkdown = mime.includes('markdown') || name.endsWith('.md');
  const isText = mime.startsWith('text/') || /\.(txt|csv|json|xml|log|ini|cfg|yaml|yml)$/i.test(name);
  const isCode = /\.(js|ts|tsx|jsx|css|html|py|java|c|cpp|h|sh|bat|sql|php|rb)$/i.test(name);
  const isWord = /\.(doc|docx)$/i.test(name);
  const isExcel = /\.(xls|xlsx)$/i.test(name);
  const isBinaryDoc = isPdf || isWord || isExcel;
  const isEditable = isMarkdown || isText || isCode || (mime.includes('html') && !isBinaryDoc);
  const needsText = isMarkdown || isText || isCode;

  // 開啟對話框時：從後端下載檔案內容
  useEffect(() => {
    if (!file || !open) return;
    if (file.type !== 'file') return;

    let revoked = false;
    let currentUrl: string | null = null;

    const load = async () => {
      try {
        setLoading(true);
        setBlobUrl(null);
        setTextContent('');
        const blob = await fileService.download(file.id);

        if (needsText) {
          const text = await blob.text();
          if (!revoked) setTextContent(text);
        } else if (isImage || isPdf) {
          currentUrl = URL.createObjectURL(blob);
          if (!revoked) setBlobUrl(currentUrl);
        }
      } catch (err) {
        console.error('載入檔案失敗:', err);
        toast.error('無法載入檔案內容');
      } finally {
        if (!revoked) setLoading(false);
      }
    };

    load();
    return () => {
      revoked = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
  }, [file?.id, open, needsText, isImage, isPdf]);

  if (!file) return null;

  const handleDownload = async () => {
    try {
      const blob = await fileService.download(file.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('下載失敗:', err);
      toast.error('下載失敗');
    }
  };

  const handleEdit = () => {
    onOpenChange(false);
    navigate(`/edit/${file.id}`);
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (isImage && blobUrl) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-muted/20 rounded-lg overflow-auto p-4">
          <img
            src={blobUrl}
            alt={file.name}
            className="max-w-full transition-transform duration-200"
            style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
          />
        </div>
      );
    }

    if (isPdf && blobUrl) {
      return (
        <iframe
          src={blobUrl}
          title={file.name}
          className="w-full min-h-[60vh] rounded-lg border bg-card"
        />
      );
    }

    if (isWord || isExcel) {
      const typeLabel = isWord ? 'Word' : 'Excel';
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-muted/20 rounded-lg p-8">
          <div className="text-center text-muted-foreground">
            <FileWarning className="w-16 h-16 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium mb-2">{typeLabel} 文件</p>
            <p className="text-sm mb-4">
              {typeLabel} 為二進位格式，目前僅支援下載後以桌面應用程式編輯。
            </p>
            <Button onClick={handleDownload} variant="outline">
              <Download className="w-4 h-4 mr-2" />下載 {typeLabel} 檔案
            </Button>
          </div>
        </div>
      );
    }

    if (isMarkdown) {
      return (
        <div className="prose prose-sm max-w-none p-6 bg-card border rounded-lg min-h-[300px] max-h-[60vh] overflow-auto">
          <ReactMarkdown>{textContent}</ReactMarkdown>
        </div>
      );
    }

    if (isCode) {
      return (
        <pre className="p-4 bg-muted/30 border rounded-lg text-sm font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap">
          {textContent}
        </pre>
      );
    }

    if (isText) {
      return (
        <pre className="p-4 bg-card border rounded-lg text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap">
          {textContent}
        </pre>
      );
    }

    return (
      <div className="flex items-center justify-center min-h-[200px] bg-muted/20 rounded-lg p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2">無法預覽此檔案格式</p>
          <p className="text-sm mb-4">{file.mimeType || '未知格式'}</p>
          <Button onClick={handleDownload} variant="outline">
            <Download className="w-4 h-4 mr-2" />下載檔案
          </Button>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between pr-6">
            <DialogTitle className="truncate">{file.name}</DialogTitle>
            <div className="flex items-center gap-1">
              {isEditable && (
                <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={handleEdit} title="線上編輯">
                  <Pencil className="w-4 h-4" />
                  編輯
                </Button>
              )}
              {isImage && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.max(25, z - 25))} title="縮小">
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-10 text-center">{zoom}%</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom(z => Math.min(300, z + 25))} title="放大">
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setRotation(r => r + 90)} title="旋轉">
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDownload} title="下載">
                <Download className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto">
          {renderPreview()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewDialog;
