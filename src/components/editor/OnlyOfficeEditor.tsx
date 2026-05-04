import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import onlyOfficeService, { type OnlyOfficeConfig } from '@/services/onlyOfficeService';

declare global {
  interface Window {
    DocsAPI?: {
      DocEditor: new (elementId: string, config: unknown) => { destroyEditor: () => void };
    };
  }
}

interface Props {
  fileId: string;
  fileName: string;
}

const containerId = 'onlyoffice-editor-root';

/**
 * 動態載入 OnlyOffice DocsAPI 並掛載 docEditor。
 * 注意：DocsAPI 來自 OnlyOffice Document Server，必須是相同的 server URL（後端 config 內已帶）。
 */
const OnlyOfficeEditor = ({ fileId, fileName }: Props) => {
  const editorRef = useRef<{ destroyEditor: () => void } | null>(null);
  const [config, setConfig] = useState<OnlyOfficeConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 1. 取 config
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    onlyOfficeService.getConfig(fileId)
      .then(cfg => { if (!cancelled) setConfig(cfg); })
      .catch(err => {
        if (cancelled) return;
        const msg = err?.response?.data?.message || '載入 OnlyOffice 設定失敗';
        setError(msg);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fileId]);

  // 2. 動態載入 DocsAPI script + 建立 editor
  useEffect(() => {
    if (!config) return;

    const apiUrl = `${config.documentServerUrl}/web-apps/apps/api/documents/api.js`;
    let scriptEl = document.querySelector<HTMLScriptElement>(`script[src="${apiUrl}"]`);
    let appended = false;

    const mount = () => {
      if (!window.DocsAPI) {
        setError('OnlyOffice DocsAPI 未載入');
        return;
      }
      // 清掉舊 editor（HMR / 切檔）
      if (editorRef.current) {
        try { editorRef.current.destroyEditor(); } catch { /* ignore */ }
      }
      try {
        editorRef.current = new window.DocsAPI.DocEditor(containerId, {
          document: config.document,
          documentType: config.documentType,
          editorConfig: config.editorConfig,
          type: 'desktop',
          token: config.token,
          width: '100%',
          height: '100%',
        });
      } catch (e: unknown) {
        setError(`OnlyOffice 編輯器初始化失敗：${(e as Error).message}`);
      }
    };

    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.src = apiUrl;
      scriptEl.async = true;
      scriptEl.onload = mount;
      scriptEl.onerror = () => setError(`無法連線至 OnlyOffice 伺服器（${config.documentServerUrl}）`);
      document.body.appendChild(scriptEl);
      appended = true;
    } else if (window.DocsAPI) {
      mount();
    } else {
      scriptEl.addEventListener('load', mount, { once: true });
    }

    return () => {
      if (editorRef.current) {
        try { editorRef.current.destroyEditor(); } catch { /* ignore */ }
        editorRef.current = null;
      }
      // script 留在 document，避免反覆切檔重複載入大檔
      if (appended) {
        // no-op
      }
    };
  }, [config]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">載入 OnlyOffice 編輯器…</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mx-6 mt-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div className="font-semibold mb-1">{fileName}</div>
          <div>{error}</div>
          <div className="text-xs opacity-80 mt-2">
            如為內部部署，請確認 OnlyOffice Document Server 已正常啟動，且 IIS 反向代理規則設定無誤。
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      {config?.lockedBy && (
        <Alert className="mx-6 mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            此文件正由 <strong>{config.lockedBy}</strong> 編輯中，目前以唯讀模式開啟。
          </AlertDescription>
        </Alert>
      )}
      <div id={containerId} className="flex-1 min-h-[600px]" />
    </>
  );
};

export default OnlyOfficeEditor;
