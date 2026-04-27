import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, ShieldCheck, ArrowLeft, FileText, AlertTriangle, MousePointerClick, CheckCircle2 } from 'lucide-react';

const CertInstall = () => {
  return (
    <div className="min-h-screen bg-background bg-grid p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link to="/login">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-1" />返回登入
            </Button>
          </Link>
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-medium">憑證安裝中心</span>
          </div>
        </div>

        {/* Title */}
        <Card className="border-border/50 glow-card">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center glow-primary">
                <ShieldCheck className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">DMS 安全憑證安裝</CardTitle>
                <CardDescription>首次連線出現「不安全」警告時請依本頁步驟安裝</CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Why */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>為什麼需要安裝憑證？</AlertTitle>
          <AlertDescription className="mt-2 text-sm">
            本系統使用內部簽發的 HTTPS 憑證以加密傳輸資料。
            您的電腦尚未信任此憑證，因此瀏覽器會顯示警告畫面。
            安裝一次後，後續登入與檔案傳輸即可完全安全（網址列鎖頭呈綠色），
            且 30 年內無需重複安裝。
          </AlertDescription>
        </Alert>

        {/* Download */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" />步驟 1：下載安裝檔
            </CardTitle>
            <CardDescription>請下載以下兩個檔案到同一個資料夾（例如桌面）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/cert/TaipowerDMS-RootCA.cer" download className="block">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">TaipowerDMS-RootCA.cer</p>
                    <p className="text-xs text-muted-foreground">系統根憑證檔</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </a>

            <a href="/cert/install-cert.bat" download className="block">
              <div className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-accent/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">install-cert.bat</p>
                    <p className="text-xs text-muted-foreground">一鍵安裝腳本</p>
                  </div>
                </div>
                <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
              </div>
            </a>
          </CardContent>
        </Card>

        {/* Run */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MousePointerClick className="w-5 h-5 text-primary" />步驟 2：直接雙擊執行（不需管理員權限）
            </CardTitle>
            <CardDescription>本版本僅安裝至「目前 Windows 使用者」，無需 UAC 權限</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <div>
                  <p>確認 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">install-cert.bat</code> 與 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">TaipowerDMS-RootCA.cer</code> 在同一個資料夾</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <div>
                  <p><strong>滑鼠左鍵雙擊</strong> <code className="bg-muted px-1.5 py-0.5 rounded text-xs">install-cert.bat</code></p>
                  <p className="text-xs text-muted-foreground mt-1">不需要選「以系統管理員身分執行」，一般使用者帳號即可</p>
                </div>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary/10 text-primary rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <div>
                  <p>等待視窗顯示 <strong className="text-primary">「✓ 憑證安裝成功」</strong> 後按任意鍵關閉</p>
                </div>
              </li>
            </ol>
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>多帳號提醒：</strong>本安裝僅對「目前 Windows 登入帳號」生效。若同一台電腦有其他 Windows 帳號需要使用本系統，請在該帳號下重新執行此 BAT。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Manual fallback */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />備用方案：手動雙擊 .cer 安裝
            </CardTitle>
            <CardDescription>若 BAT 執行失敗（例如防毒軟體攔截），可改用此方法</CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-2 text-sm list-decimal list-inside">
              <li>滑鼠雙擊 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">TaipowerDMS-RootCA.cer</code></li>
              <li>點擊「<strong>安裝憑證</strong>」按鈕</li>
              <li>儲存位置選擇「<strong>目前使用者</strong>」→ 下一步</li>
              <li>選「<strong>將所有憑證放入以下的存放區</strong>」→ 點「瀏覽」</li>
              <li>選擇「<strong>受信任的根憑證授權單位</strong>」→ 確定 → 下一步 → 完成</li>
              <li>出現安全性警告時點「<strong>是</strong>」即完成</li>
            </ol>
          </CardContent>
        </Card>

        {/* Verify */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />步驟 3：驗證安裝結果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ol className="space-y-2 list-decimal list-inside">
              <li>完全關閉所有 Chrome / Edge 視窗</li>
              <li>重新開啟瀏覽器，連線至 <code className="bg-muted px-1.5 py-0.5 rounded text-xs">https://10.205.3.52:7443</code></li>
              <li>確認網址列左側鎖頭顯示為「安全」（不再有紅色警告）</li>
              <li>正常進入登入頁即代表完成 ✓</li>
            </ol>
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                若仍出現警告，請改用「備用方案」手動雙擊 .cer 安裝，或聯絡系統管理員協助。
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground pb-4">
          桃園區處文件管理系統 · 憑證有效期 30 年（至 2055 年）
        </div>
      </div>
    </div>
  );
};

export default CertInstall;
