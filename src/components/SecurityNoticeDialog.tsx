import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShieldCheck } from 'lucide-react';

const NOTICE_KEY = 'dms_security_notice_accepted';

/** 取得今天日期字串 yyyy-mm-dd */
const today = () => new Date().toISOString().slice(0, 10);

const SecurityNoticeDialog: React.FC = () => {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // 每天登入首次顯示一次
    const last = localStorage.getItem(NOTICE_KEY);
    if (last !== today()) {
      setOpen(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(NOTICE_KEY, today());
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[560px]" onPointerDownOutside={e => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5 text-primary" />
            資訊安全與個人資料保護規範
          </DialogTitle>
          <DialogDescription>
            使用本系統前，請詳閱以下規範事項。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4 text-sm leading-relaxed text-foreground">
            <section>
              <h3 className="font-semibold text-base mb-1">壹、資訊安全原則</h3>
              <ol className="list-decimal list-inside space-y-1 pl-2">
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
              <h3 className="font-semibold text-base mb-1">貳、個人資料保護原則</h3>
              <ol className="list-decimal list-inside space-y-1 pl-2">
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

            <p className="text-muted-foreground text-xs pt-2">
              違反上述規範者，將依相關法規及本機構內部規定議處。
            </p>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button onClick={handleAccept} className="w-full sm:w-auto">
            我已閱讀並同意遵守上述規範
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SecurityNoticeDialog;
