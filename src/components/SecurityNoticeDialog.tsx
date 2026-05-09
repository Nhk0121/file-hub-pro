import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowDown } from 'lucide-react';

const SecurityNoticeDialog: React.FC = () => {
  const [open, setOpen] = useState(true);
  const [scrolledBottom, setScrolledBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 每次登入（元件掛載）都強迫顯示一次
  useEffect(() => {
    setOpen(true);
    setScrolledBottom(false);
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    // 容許 8px 誤差
    if (el.scrollHeight - el.scrollTop - el.clientHeight <= 8) {
      setScrolledBottom(true);
    }
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  };

  const handleAccept = () => {
    if (!scrolledBottom) return;
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[720px] max-h-[90vh] flex flex-col"
        onPointerDownOutside={e => e.preventDefault()}
        onEscapeKeyDown={e => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <ShieldCheck className="h-7 w-7 text-primary" />
            資訊安全與個人資料保護規範
          </DialogTitle>
          <DialogDescription className="text-base">
            使用本系統前，請<span className="font-semibold text-foreground">詳閱以下規範</span>，並滑動至最底部後方可確認關閉。
          </DialogDescription>
        </DialogHeader>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto pr-4 border rounded-md p-4 bg-muted/20"
          style={{ maxHeight: '55vh' }}
        >
          <div className="space-y-6 text-base leading-loose text-foreground">
            <section>
              <h3 className="font-bold text-xl mb-3 text-primary">壹、資訊安全原則</h3>
              <ol className="list-decimal list-outside space-y-2 pl-6">
                <li>使用者應妥善保管個人帳號與密碼，不得將帳號借予他人使用或分享密碼。</li>
                <li>密碼應定期更換（建議至少每 90 天），並符合至少 12 位元之複雜度要求。</li>
                <li>禁止於系統中上傳含有惡意程式、病毒或未經授權之軟體。</li>
                <li>存取檔案應遵循最小權限原則，僅存取業務所需之資料與文件。</li>
                <li>離開座位或長時間未操作時，應登出系統或鎖定畫面，避免未授權存取。</li>
                <li>發現資安異常事件（如帳號遭盜用、異常登入等），應立即通報系統管理員。</li>
                <li>系統操作行為均會留存稽核紀錄，以供資安事件調查之用。</li>
                <li>嚴禁嘗試繞過系統權限控制或進行未經授權之操作。</li>
              </ol>
            </section>

            <section>
              <h3 className="font-bold text-xl mb-3 text-primary">貳、個人資料保護原則</h3>
              <ol className="list-decimal list-outside space-y-2 pl-6">
                <li>本系統蒐集、處理及利用個人資料，均依據《個人資料保護法》及相關規定辦理。</li>
                <li>使用者僅得於業務必要範圍內存取他人個人資料，不得作為業務以外之用途。</li>
                <li>嚴禁擅自複製、列印、傳輸或對外揭露系統內之個人資料。</li>
                <li>含有個人資料之檔案應設定適當之存取權限，避免非授權人員取得。</li>
                <li>外包人員使用本系統時，應遵守與本機構簽訂之保密協定及個資保護條款。</li>
                <li>個人資料之蒐集應告知當事人蒐集目的與利用範圍，並取得同意。</li>
                <li>如發生個人資料外洩事件，應立即通報管理人員並配合後續調查處理。</li>
                <li>離職或業務異動時，應繳回或刪除所持有之個人資料相關檔案。</li>
              </ol>
            </section>

            <section>
              <h3 className="font-bold text-xl mb-3 text-primary">參、違規與處置</h3>
              <ol className="list-decimal list-outside space-y-2 pl-6">
                <li>違反上述任一規範者，將依機構內部規定及相關法規議處。</li>
                <li>情節重大者，本系統得依規定逕行<span className="font-semibold text-destructive">停權處分</span>，並通報相關權責單位。</li>
                <li>所有操作行為均留存稽核紀錄，作為事後責任歸屬與調查依據。</li>
              </ol>
            </section>

            <p className="text-center text-base font-semibold text-primary pt-4 border-t">
              ── 本人已詳閱並了解上述規範內容 ──
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {!scrolledBottom && (
            <Button
              type="button"
              variant="outline"
              onClick={scrollToBottom}
              className="w-full sm:w-auto"
            >
              <ArrowDown className="h-4 w-4 mr-1" />
              捲動至最底部
            </Button>
          )}
          <Button
            onClick={handleAccept}
            disabled={!scrolledBottom}
            className="w-full sm:w-auto text-base"
            size="lg"
          >
            {scrolledBottom ? '我已閱讀並同意遵守上述規範' : '請先捲動至最底部'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SecurityNoticeDialog;
