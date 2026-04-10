import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, ZoomIn, ZoomOut, RotateCw, Pencil, FileWarning } from 'lucide-react';
import type { FileItem } from '@/types';
import ReactMarkdown from 'react-markdown';

interface FilePreviewDialogProps {
  file: FileItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FilePreviewDialog = ({ file, open, onOpenChange }: FilePreviewDialogProps) => {
  const navigate = useNavigate();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  if (!file || !file.content) return null;

  const name = file.name.toLowerCase();
  const isImage = file.mimeType?.startsWith('image/') || /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(name);
  const isPdf = file.mimeType === 'application/pdf' || name.endsWith('.pdf');
  const isMarkdown = file.mimeType?.includes('markdown') || name.endsWith('.md');
  const isText = file.mimeType?.startsWith('text/') || /\.(txt|csv|json|xml|log|ini|cfg|yaml|yml)$/i.test(name);
  const isCode = /\.(js|ts|tsx|jsx|css|html|py|java|c|cpp|h|sh|bat|sql|php|rb)$/i.test(name);
  const isWord = /\.(doc|docx)$/i.test(name);
  const isExcel = /\.(xls|xlsx)$/i.test(name);
  const isBinaryDoc = isPdf || isWord || isExcel;

  // 可線上編輯的文字檔
  const isEditable = isMarkdown || isText || isCode || (file.mimeType?.includes('html') && !isBinaryDoc);

  const handleDownload = () => {
    let blob: Blob;
    if (file.content!.startsWith('data:')) {
      const [, base64] = file.content!.split(',');
      const binary = atob(base64);
      const arr = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
      blob = new Blob([arr]);
    } else {
      blob = new Blob([file.content!], { type: file.mimeType || 'text/plain' });
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  };

  const handleEdit = () => {
    onOpenChange(false);
    navigate(`/edit/${file.id}`);
  };

  const renderPreview = () => {
    if (isImage) {
      return (
        <div className="flex items-center justify-center min-h-[400px] bg-muted/20 rounded-lg overflow-auto p-4">
          <img
            src={file.content!}
            alt={file.name}
            className="max-w-full transition-transform duration-200"
            style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
          />
        </div>
      );
    }

    if (isBinaryDoc) {
      const typeLabel = isPdf ? 'PDF' : isWord ? 'Word' : 'Excel';
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
          <ReactMarkdown>{file.content!}</ReactMarkdown>
        </div>
      );
    }

    if (isCode) {
      return (
        <pre className="p-4 bg-muted/30 border rounded-lg text-sm font-mono overflow-auto max-h-[60vh] whitespace-pre-wrap">
          {file.content!}
        </pre>
      );
    }

    if (isText) {
      return (
        <pre className="p-4 bg-card border rounded-lg text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap">
          {file.content!}
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
