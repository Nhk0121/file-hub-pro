import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { FileText, Shield, Users, Clock, ArrowRight, Database, Zap, Lock, Eye, Trash2, HardDrive } from 'lucide-react';
import { useMonthlyTheme } from '@/hooks/useMonthlyTheme';
import { useSystemTitle } from '@/contexts/SystemTitleContext';

const Landing = () => {
  const navigate = useNavigate();
  const theme = useMonthlyTheme();
  const { title: systemTitle, designer } = useSystemTitle();

  const features = [
    { icon: <FileText className="w-6 h-6" />, title: '文件集中管理', desc: '時效區與永久區分層架構，組別課別系統化歸檔，支援 Markdown、富文字與純文字線上編輯' },
    { icon: <Shield className="w-6 h-6" />, title: '資安與個資保護', desc: '上傳自動個資偵測、執行檔管控、細分資料夾權限，符合個資法與資安規範' },
    { icon: <Eye className="w-6 h-6" />, title: '線上預覽與編輯', desc: '支援圖片縮放旋轉、TXT/Markdown/HTML 線上編輯；Word、Excel、PDF 可預覽與下載' },
    { icon: <Trash2 className="w-6 h-6" />, title: '資源回收桶', desc: '誤刪檔案可在 30 天內還原，刪除前二次確認，由系統管理員統一管理' },
    { icon: <Clock className="w-6 h-6" />, title: '時效區自動提醒', desc: '時效區檔案顯示剩餘天數倒數提醒，超過 30 天由管理員清理至回收桶' },
    { icon: <Database className="w-6 h-6" />, title: '完整稽核追蹤', desc: '所有操作皆留紀錄，支援篩選查詢與 CSV 匯出，符合稽核要求' },
    { icon: <HardDrive className="w-6 h-6" />, title: '儲存空間管理', desc: '永久區與時效區獨立配額設定，支援各組別空間使用率監控與上限調整' },
    { icon: <Users className="w-6 h-6" />, title: '組織架構整合', desc: '16 組別對應實體編制，支援員工與外包人員分級管理、帳號審核流程' },
    { icon: <Lock className="w-6 h-6" />, title: '帳號安全機制', desc: '12 位元密碼政策、每日資安宣導、密碼自行變更、系統管理員與管理員分級權限' },
  ];

  return (
    <div className="min-h-screen bg-background bg-grid relative overflow-hidden">
      {/* Decorative blurs */}
      <div className="absolute top-[-200px] left-[-100px] w-[500px] h-[500px] bg-primary/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-200px] right-[-100px] w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/3 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 border-b border-border/50 glass">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center glow-primary">
              <FileText className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <span className="font-bold text-foreground text-sm">{systemTitle}</span>
              <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">DMS v2.0</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">{theme.name}主題</span>
            <Button onClick={() => navigate('/login')} size="sm">
              登入系統 <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
          <Zap className="w-3.5 h-3.5" />
          台灣電力公司 · 桃園區營業處
        </div>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-tight mb-6">
          桃園區處
          <br />
          <span className="text-primary">文件管理系統</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          整合文件歸檔、權限控管、稽核追蹤與組織管理，<br className="hidden md:block" />
          打造安全、高效、合規的數位文件管理平台
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button size="lg" onClick={() => navigate('/login')} className="glow-primary text-base px-8">
            進入系統 <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-3">系統功能特色</h2>
          <p className="text-muted-foreground">完善的企業級文件管理解決方案</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div key={i} className="group p-6 rounded-xl bg-card border border-border/50 glow-card">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                {f.icon}
              </div>
              <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { value: '16', label: '組別單位' },
            { value: '9+', label: '核心功能模組' },
            { value: '30天', label: '回收桶保留' },
            { value: '100%', label: '操作可追溯' },
          ].map((s, i) => (
            <div key={i} className="text-center p-6 rounded-xl glass">
              <div className="text-3xl font-bold text-primary mb-1">{s.value}</div>
              <div className="text-sm text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 glass">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} 台灣電力公司桃園區營業處 · 文件管理系統
          </p>
          <div className="flex flex-col md:items-end gap-1">
            <p className="text-xs text-muted-foreground">
              本系統僅供授權人員使用，所有操作均受稽核紀錄
            </p>
            <p className="text-xs text-muted-foreground">
              網頁設計：<span className="text-primary font-medium">{designer}</span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
