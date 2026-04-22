using System;
using System.Collections.Generic;
using System.Data;
using System.IO;
using System.Text.RegularExpressions;
using System.Web;

/// <summary>
/// 登入防護與上傳安全檢查
/// </summary>
public static class 登入安全輔助
{
    public static bool 已被暫時鎖定(string 帳號, string IP, out string 訊息)
    {
        int 失敗次數 = 設定輔助.取得整數("登入失敗鎖定次數", 5);
        int 鎖定分鐘 = 設定輔助.取得整數("登入鎖定分鐘數", 15);
        int 視窗分鐘 = 設定輔助.取得整數("登入失敗計算分鐘數", 鎖定分鐘);

        bool 有登入欄位 = 資料庫輔助.欄位存在("操作紀錄", "登入帳號");
        string 條件 = 有登入欄位
            ? "(登入帳號=@帳號 OR 操作者IP=@IP)"
            : "(操作者IP=@IP OR 備註 LIKE @帳號樣式)";

        object result = 資料庫輔助.查詢單值(string.Format(@"
            SELECT COUNT(*)
            FROM 操作紀錄
            WHERE 操作類型='登入'
              AND 操作結果='失敗'
              AND 操作時間 >= DATEADD(minute, -@視窗, GETDATE())
              AND {0}", 條件),
            資料庫輔助.P("@視窗", 視窗分鐘),
            資料庫輔助.P("@帳號", 帳號),
            資料庫輔助.P("@IP", IP),
            資料庫輔助.P("@帳號樣式", "%帳號=" + 帳號 + "%"));

        int 次數 = Convert.ToInt32(result ?? 0);
        if (次數 < 失敗次數)
        {
            訊息 = "";
            return false;
        }

        object 最新失敗 = 資料庫輔助.查詢單值(string.Format(@"
            SELECT MAX(操作時間)
            FROM 操作紀錄
            WHERE 操作類型='登入'
              AND 操作結果='失敗'
              AND {0}", 條件),
            資料庫輔助.P("@帳號", 帳號),
            資料庫輔助.P("@IP", IP),
            資料庫輔助.P("@帳號樣式", "%帳號=" + 帳號 + "%"));

        if (最新失敗 == null || 最新失敗 == DBNull.Value)
        {
            訊息 = "";
            return false;
        }

        DateTime 解鎖時間 = Convert.ToDateTime(最新失敗).AddMinutes(鎖定分鐘);
        if (解鎖時間 <= DateTime.Now)
        {
            訊息 = "";
            return false;
        }

        int 剩餘分鐘 = Math.Max(1, (int)Math.Ceiling((解鎖時間 - DateTime.Now).TotalMinutes));
        訊息 = string.Format("登入失敗次數過多，請於 {0} 分鐘後再試", 剩餘分鐘);
        return true;
    }
}

public static class 檔案安全輔助
{
    private static readonly Regex 檔名格式 = new Regex(@"^[^\\/:*?""<>|]+$", RegexOptions.Compiled);
    private static readonly string[] 危險副檔名 = { ".exe", ".bat", ".cmd", ".com", ".ps1", ".vbs", ".js", ".msi", ".dll", ".scr", ".hta", ".jar" };
    private static readonly Dictionary<string, string[]> 允許Mime對照 = new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
    {
        { ".pdf", new[] { "application/pdf" } },
        { ".txt", new[] { "text/plain" } },
        { ".csv", new[] { "text/csv", "application/csv", "application/vnd.ms-excel", "text/plain" } },
        { ".jpg", new[] { "image/jpeg", "image/pjpeg" } },
        { ".jpeg", new[] { "image/jpeg", "image/pjpeg" } },
        { ".png", new[] { "image/png", "image/x-png" } },
        { ".gif", new[] { "image/gif" } },
        { ".zip", new[] { "application/zip", "application/x-zip-compressed", "multipart/x-zip" } },
        { ".doc", new[] { "application/msword" } },
        { ".docx", new[] { "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip" } },
        { ".xls", new[] { "application/vnd.ms-excel" } },
        { ".xlsx", new[] { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip" } },
        { ".ppt", new[] { "application/vnd.ms-powerpoint" } },
        { ".pptx", new[] { "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip" } }
    };

    public static bool 驗證上傳檔案(HttpPostedFile file, string IP, out string 錯誤訊息)
    {
        錯誤訊息 = "";
        if (file == null || file.ContentLength <= 0)
        {
            錯誤訊息 = "未收到有效檔案";
            return false;
        }

        string 檔名 = Path.GetFileName(file.FileName ?? "");
        if (string.IsNullOrWhiteSpace(檔名) || 檔名.Length > 200)
        {
            錯誤訊息 = "檔名不合法";
            return false;
        }
        if (!檔名格式.IsMatch(檔名) || 檔名.EndsWith(".", StringComparison.Ordinal))
        {
            錯誤訊息 = "檔名包含不允許的字元";
            return false;
        }

        string 副檔名 = Path.GetExtension(檔名).ToLowerInvariant();
        if (string.IsNullOrEmpty(副檔名))
        {
            錯誤訊息 = "檔案必須包含副檔名";
            return false;
        }

        if (檔名.IndexOf('\0') >= 0 || 檔名.Contains(".."))
        {
            錯誤訊息 = "檔名格式不正確";
            return false;
        }

        string[] 區段 = 檔名.Split('.');
        if (區段.Length >= 3)
        {
            string 次副檔名 = "." + 區段[區段.Length - 2].ToLowerInvariant();
            if (Array.IndexOf(危險副檔名, 次副檔名) >= 0)
            {
                錯誤訊息 = "不允許使用雙重副檔名偽裝檔案";
                return false;
            }
        }

        bool 是危險檔 = Array.IndexOf(危險副檔名, 副檔名) >= 0;
        if (是危險檔 && !IP輔助.可上傳執行檔(IP))
        {
            錯誤訊息 = "此IP不允許上傳執行檔";
            return false;
        }

        string mime = (file.ContentType ?? "").Trim();
        if (允許Mime對照.ContainsKey(副檔名) && !Mime符合(允許Mime對照[副檔名], mime))
        {
            錯誤訊息 = "檔案類型與副檔名不符";
            return false;
        }

        return true;
    }

    private static bool Mime符合(string[] allowed, string mime)
    {
        if (string.IsNullOrWhiteSpace(mime)) return false;
        foreach (string item in allowed)
        {
            if (string.Equals(item, mime, StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }
}

public static class 例外處理輔助
{
    public static void 記錄例外(Exception ex, string 類型, string 目標資源, string 說明 = null)
    {
        try
        {
            string ip = IP輔助.取得用戶端IP();
            string detail = (說明 ?? "") + " | " + ex.GetType().Name + ": " + ex.Message;
            if (detail.Length > 1000) detail = detail.Substring(0, 1000);

            操作紀錄輔助.資安警示(
                類型 ?? "系統例外",
                "高",
                ip,
                目標資源 ?? "",
                detail);
        }
        catch { }
    }
}
