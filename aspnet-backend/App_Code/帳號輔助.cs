using System;
using System.Data;
using System.Security.Cryptography;
using System.Text;
using System.Web;

/// <summary>
/// 帳號密碼輔助 - SHA256 + Salt 雜湊
/// </summary>
public static class 密碼輔助
{
    public static string 產生鹽值()
    {
        byte[] b = new byte[32];
        using (var rng = new RNGCryptoServiceProvider())
            rng.GetBytes(b);
        return Convert.ToBase64String(b);
    }

    public static string 計算雜湊(string 密碼, string 鹽值)
    {
        using (var sha = SHA256.Create())
        {
            byte[] 原始 = Encoding.UTF8.GetBytes(鹽值 + 密碼.ToLower()); // 不分大小寫
            return Convert.ToBase64String(sha.ComputeHash(原始));
        }
    }

    public static bool 驗證密碼(string 輸入密碼, string 雜湊, string 鹽值)
    {
        return 計算雜湊(輸入密碼, 鹽值) == 雜湊;
    }

    public static bool 密碼強度合格(string 密碼)
    {
        return 密碼 != null && 密碼.Length >= 12;
    }
}

/// <summary>
/// 帳號資料輔助
/// </summary>
public static class 帳號輔助
{
    // ── 初始化超管密碼 ────────────────────────────────────────
    public static void 初始化超管()
    {
        var dt = 資料庫輔助.查詢(
            "SELECT 帳號編號, 密碼雜湊 FROM 使用者帳號 WHERE 登入帳號='000000'");
        if (dt.Rows.Count == 0) return;
        if (dt.Rows[0]["密碼雜湊"].ToString() != "INIT_HASH") return;

        // 首次執行：設定預設密碼 Admin@123456
        string 鹽值 = 密碼輔助.產生鹽值();
        string 雜湊 = 密碼輔助.計算雜湊("Admin@123456", 鹽值);
        資料庫輔助.執行(
            "UPDATE 使用者帳號 SET 密碼雜湊=@h, 密碼鹽值=@s WHERE 登入帳號='000000'",
            資料庫輔助.P("@h", 雜湊),
            資料庫輔助.P("@s", 鹽值));
    }

    // ── 登入驗證 ─────────────────────────────────────────────
    public static DataRow 驗證登入(string 帳號, string 密碼)
    {
        var dt = 資料庫輔助.查詢(@"
            SELECT u.帳號編號, u.登入帳號, u.姓名, u.姓名代號, u.角色, u.員工類型,
                   u.組別編號, u.課別, u.分機, u.密碼雜湊, u.密碼鹽值, u.帳號狀態,
                   g.組別名稱, g.組別代碼
            FROM 使用者帳號 u
            LEFT JOIN 組別設定 g ON u.組別編號=g.組別編號
            WHERE u.登入帳號=@帳號",
            資料庫輔助.P("@帳號", 帳號));

        if (dt.Rows.Count == 0) return null;
        var row = dt.Rows[0];
        if (row["帳號狀態"].ToString() != "啟用") return null;
        if (!密碼輔助.驗證密碼(密碼, row["密碼雜湊"].ToString(), row["密碼鹽值"].ToString()))
            return null;
        return row;
    }

    // ── 寫入 Session ──────────────────────────────────────────
    public static void 寫入Session(DataRow user)
    {
        var s = HttpContext.Current.Session;
        s["已登入"]     = true;
        s["帳號編號"]   = Convert.ToInt32(user["帳號編號"]);
        s["登入帳號"]   = user["登入帳號"].ToString();
        s["姓名"]       = user["姓名"].ToString();
        s["姓名代號"]   = user["姓名代號"].ToString();
        s["角色"]       = user["角色"].ToString();
        s["員工類型"]   = user["員工類型"].ToString();
        s["組別編號"]   = user["組別編號"] == DBNull.Value ? (int?)null : Convert.ToInt32(user["組別編號"]);
        s["組別名稱"]   = user["組別名稱"] == DBNull.Value ? "" : user["組別名稱"].ToString();
        s["課別"]       = user["課別"].ToString();
    }

    // ── 取得目前使用者資訊 ────────────────────────────────────
    public static string 取得姓名()
    {
        if (HttpContext.Current == null) return "";
        var s = HttpContext.Current.Session;
        if (s == null || s["姓名"] == null) return "";
        return s["姓名"].ToString();
    }

    public static string 取得角色()
    {
        if (HttpContext.Current == null) return "";
        var s = HttpContext.Current.Session;
        if (s == null || s["角色"] == null) return "";
        return s["角色"].ToString();
    }

    public static int? 取得組別編號()
    {
        if (HttpContext.Current == null) return null;
        var s = HttpContext.Current.Session;
        if (s == null || s["組別編號"] == null) return null;
        return s["組別編號"] as int?;
    }

    public static int 取得帳號編號()
    {
        if (HttpContext.Current == null) return 0;
        var s = HttpContext.Current.Session;
        if (s == null || s["帳號編號"] == null) return 0;
        return Convert.ToInt32(s["帳號編號"]);
    }

    // ── 申請帳號 ─────────────────────────────────────────────
    public static string 新增帳號申請(string 姓名, string 姓名代號, int? 組別編號,
        string 課別, string 分機, string 密碼, string 員工類型, string 建立者 = null)
    {
        // 驗證代號唯一
        var 重複 = 資料庫輔助.查詢單值(
            "SELECT COUNT(*) FROM 使用者帳號 WHERE 姓名代號=@代號",
            資料庫輔助.P("@代號", 姓名代號));
        if (Convert.ToInt32(重複) > 0) return "此姓名代號已被使用";

        // 驗證密碼強度
        if (!密碼輔助.密碼強度合格(密碼)) return "密碼至少需要12個字元";

        string 鹽值 = 密碼輔助.產生鹽值();
        string 雜湊 = 密碼輔助.計算雜湊(密碼, 鹽值);

        string 帳號狀態 = 建立者 != null ? "啟用" : "待審核"; // 管理員建立直接啟用
        string 角色 = 員工類型 == "外包" ? "外包" : "員工";
        DateTime? 核准時間 = 建立者 != null ? (DateTime?)DateTime.Now : null;

        資料庫輔助.執行(@"
            INSERT INTO 使用者帳號
                (登入帳號,姓名,姓名代號,組別編號,課別,分機,密碼雜湊,密碼鹽值,
                 角色,員工類型,帳號狀態,核准時間,核准者帳號,建立者)
            VALUES
                (@帳號,@姓名,@代號,@組別,@課別,@分機,@雜湊,@鹽,
                 @角色,@員工類型,@狀態,@核准時間,@核准者,@建立者)",
            資料庫輔助.P("@帳號",    姓名代號),
            資料庫輔助.P("@姓名",    姓名),
            資料庫輔助.P("@代號",    姓名代號),
            資料庫輔助.P("@組別",    (object)組別編號 ?? DBNull.Value),
            資料庫輔助.P("@課別",    課別),
            資料庫輔助.P("@分機",    分機),
            資料庫輔助.P("@雜湊",    雜湊),
            資料庫輔助.P("@鹽",      鹽值),
            資料庫輔助.P("@角色",    角色),
            資料庫輔助.P("@員工類型", 員工類型),
            資料庫輔助.P("@狀態",    帳號狀態),
            資料庫輔助.P("@核准時間", (object)核准時間 ?? DBNull.Value),
            資料庫輔助.P("@核准者",  (object)建立者 ?? DBNull.Value),
            資料庫輔助.P("@建立者",  (object)建立者 ?? DBNull.Value));

        return ""; // 空字串=成功
    }

    // ── 修改密碼 ─────────────────────────────────────────────
    public static bool 修改密碼(int 帳號編號, string 新密碼)
    {
        if (!密碼輔助.密碼強度合格(新密碼)) return false;
        string 鹽值 = 密碼輔助.產生鹽值();
        string 雜湊 = 密碼輔助.計算雜湊(新密碼, 鹽值);
        資料庫輔助.執行(
            "UPDATE 使用者帳號 SET 密碼雜湊=@h, 密碼鹽值=@s WHERE 帳號編號=@id",
            資料庫輔助.P("@h", 雜湊),
            資料庫輔助.P("@s", 鹽值),
            資料庫輔助.P("@id", 帳號編號));
        return true;
    }

    // ── 更新最後登入 ──────────────────────────────────────────
    public static void 更新登入紀錄(int 帳號編號, string IP)
    {
        資料庫輔助.執行(
            "UPDATE 使用者帳號 SET 最後登入=GETDATE(), 最後登入IP=@IP WHERE 帳號編號=@id",
            資料庫輔助.P("@IP", IP),
            資料庫輔助.P("@id", 帳號編號));
    }
}

/// <summary>
/// 角色權限輔助（完整版，取代舊版）
/// </summary>
public static class 角色輔助
{
    public static string 取得角色() { return 帳號輔助.取得角色(); }
    public static int? 取得組別() { return 帳號輔助.取得組別編號(); }

    public static bool 是超管()       { return 取得角色() == "超管"; }
    public static bool 是資訊人員()    { return 取得角色() == "資訊人員"; }
    public static bool 是負責人()      { return 取得角色() == "負責人"; }
    public static bool 是員工()        { return 取得角色() == "員工"; }
    public static bool 是外包()        { return 取得角色() == "外包"; }

    /// <summary>超管或資訊人員（全組別不受限）</summary>
    public static bool 是管理員()      { return 是超管() || 是資訊人員(); }

    /// <summary>是否可對指定組別永久區上傳/刪除</summary>
    public static bool 可操作永久區(int 目標組別編號)
    {
        if (是管理員()) return true;             // 超管/資訊人員無限制
        if (是外包()) return false;              // 外包不可
        int? 我的組別 = 取得組別();
        if (我的組別 == null) return false;
        return 我的組別.Value == 目標組別編號;   // 本組員工或負責人
    }

    /// <summary>是否可下載他組永久區檔案（外包不行）</summary>
    public static bool 可下載永久區() { return !是外包(); }

    /// <summary>是否可查看稽核頁面</summary>
    public static bool 可查看稽核() { return 是超管() || 是資訊人員(); }

    /// <summary>是否可管理帳號（僅超管）</summary>
    public static bool 可管理帳號() { return 是超管(); }

    /// <summary>是否可修改系統設定</summary>
    public static bool 可修改系統設定() { return 是超管() || 是資訊人員(); }

    /// <summary>是否為本組負責人（含超管/資訊人員）</summary>
    public static bool 是本組負責人(int 組別編號)
    {
        if (是管理員()) return true;
        if (取得角色() != "負責人") return false;
        return 取得組別() == 組別編號;
    }

    // ── 頁面跳轉保護 ─────────────────────────────────────────
    public static bool 要求管理員(System.Web.UI.Page page)
    {
        if (是管理員()) return true;
        page.Response.Redirect("~/首頁.aspx?msg=權限不足", false);
        return false;
    }

    public static bool 要求超管(System.Web.UI.Page page)
    {
        if (是超管()) return true;
        page.Response.Redirect("~/首頁.aspx?msg=僅超管可操作", false);
        return false;
    }

    public static bool 有任何負責人權限()
    {
        if (是管理員()) return true;
        return 取得角色() == "負責人";
    }

    /// <summary>要求負責人以上（含管理員），否則導回首頁</summary>
    public static bool 要求負責人以上(System.Web.UI.Page page)
    {
        if (是管理員() || 取得角色() == "負責人") return true;
        page.Response.Redirect("~/首頁.aspx?msg=需要負責人以上權限", false);
        return false;
    }
}
