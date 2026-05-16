import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import onlyOfficeService, { type OnlyOfficeConfig } from '@/services/onlyOfficeService';

interface OnlyOfficeEditorProps {
  fileId: string;
  height?: string;
}

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (elementId: string, config: unknown) => { destroyEditor: () => void };
    };
  }
}

/**
 * OnlyOffice Document Server 線上編輯元件
 * - 從後端取得 config (含 JWT)
 * - 動態載入 DocsAPI script
 * - 掛載編輯器到指定 div
 */
const OnlyOfficeEditor = ({ fileId, height = 'calc(100vh - 200px)' }: OnlyOfficeEditorProps) => {
  const containerId = `onlyoffice-${fileId}`;
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const mount = async () => {
      try {
        setLoading(true);
        setError(null);

        const config: OnlyOfficeConfig = await onlyOfficeService.getConfig(fileId);

        // 動態載入 DocsAPI script（若尚未載入）
        const scriptSrc = `${config.documentServerUrl.replace(/\/$/, '')}/web-apps/apps/api/documents/api.js`;
        if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
          await new Promise<void>((resolve, reject) => {
            const s = document.createElement('script');
            s.src = scriptSrc;
            s.async = true;
            s.onload = () => resolve();
            s.onerror = () => reject(new Error(`無法載入 DocsAPI: ${scriptSrc}`));
            document.head.appendChild(s);
          });
        }

        // 等到 window.DocsAPI 可用（最多 5 秒）
        for (let i = 0; i < 50 && !window.DocsAPI; i++) {
          await new Promise(r => setTimeout(r, 100));
        }
        if (!window.DocsAPI) throw new Error('DocsAPI 載入逾時');

        if (cancelled) return;

        editorRef.current = new window.DocsAPI.DocEditor(containerId, {
          document: config.document,
          documentType: config.documentType,
          editorConfig: config.editorConfig,
          token: config.token,
          width: '100%',
          height: '100%',
        });
        setLoading(false);
      } catch (err: any) {
        console.error('OnlyOffice 載入失敗:', err);
        if (!cancelled) {
          setError(err?.response?.data?.message || err?.message || '無法開啟線上編輯器');
          setLoading(false);
        }
      }
    };

    mount();

    return () => {
      cancelled = true;
      try { editorRef.current?.destroyEditor(); } catch { /* ignore */ }
      editorRef.current = null;
    };
  }, [fileId, containerId]);

  if (error) {
    return (
      <Alert variant="destructive" className="m-6">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          OnlyOffice 載入失敗：{error}
          <div className="text-xs mt-2 opacity-80">
            請先以管理員身分呼叫 <code>/api/onlyoffice/diagnose</code> 確認 DocServer 連線狀態。
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="relative w-full" style={{ height }}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 z-10">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      )}
      <div id={containerId} className="w-full h-full" />
    </div>
  );
};

export default OnlyOfficeEditor;
