import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import shareService, { PublicShareInfo } from '@/services/shareService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, FileText, AlertTriangle, Loader2 } from 'lucide-react';

const formatSize = (bytes: number) => {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const PublicShare = () => {
  const { token = '' } = useParams<{ token: string }>();
  const [info, setInfo] = useState<PublicShareInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    shareService
      .getPublicInfo(token)
      .then(d => { if (mounted) setInfo(d); })
      .catch(err => {
        const msg = err?.response?.data?.message || '此分享連結無效或已撤銷';
        if (mounted) setError(msg);
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token]);

  const handleDownload = () => {
    window.location.href = shareService.getPublicDownloadUrl(token);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            桃園區處 DMS 公開下載
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />載入中…
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-3 p-4 rounded-md bg-destructive/10 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">無法存取</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          {!loading && info && (
            <>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">檔案名稱</p>
                <p className="font-medium break-all">{info.fileName}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">大小</p>
                  <p>{formatSize(info.size)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">分享者</p>
                  <p>{info.sharedBy}</p>
                </div>
              </div>
              <Button className="w-full" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />下載檔案
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                此連結由桃園區處內部人員建立，您正在以未登入身份下載。
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PublicShare;
