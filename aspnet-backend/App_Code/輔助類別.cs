using System;
using System.Data;
using System.Data.SqlClient;
using System.Configuration;
using System.Web;

/// <summary>
/// 資料庫存取輔助類別
/// </summary>
public static class 資料庫輔助
{
    private static string 連線字串 { get { return ConfigurationManager.ConnectionStrings["文件管理系統DB"].ConnectionString; } }

    public static SqlConnection 取得連線()
    {
        return new SqlConnection(連線字串);
    }

    public static DataTable 查詢(string sql, params SqlParameter[] 參數)
    {
        using (var conn = 取得連線())
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.CommandTimeout = 60;
            if (參數 != null) cmd.Parameters.AddRange(參數);
            var dt = new DataTable();
            conn.Open();
            new SqlDataAdapter(cmd).Fill(dt);
            return dt;
        }
    }

    public static int 執行(string sql, params SqlParameter[] 參數)
    {
        using (var conn = 取得連線())
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.CommandTimeout = 60;
            if (參數 != null) cmd.Parameters.AddRange(參數);
            conn.Open();
            return cmd.ExecuteNonQuery();
        }
    }

    public static object 查詢單值(string sql, params SqlParameter[] 參數)
    {
        using (var conn = 取得連線())
        using (var cmd = new SqlCommand(sql, conn))
        {
            cmd.CommandTimeout = 60;
            if (參數 != null) cmd.Parameters.AddRange(參數);
            conn.Open();
            return cmd.ExecuteScalar();
        }
    }

    public static SqlParameter P(string name, object value)
    {
        return new SqlParameter(name, value ?? DBNull.Value);
    }

    public static bool 欄位存在(string 資料表名稱, string 欄位名稱)
    {
        try
        {
            object result = 查詢單值(@"
                SELECT COUNT(*)
                FROM sys.columns
                WHERE object_id = OBJECT_ID(@資料表名稱) AND name = @欄位名稱",
                P("@資料表名稱", 資料表名稱),
                P("@欄位名稱", 欄位名稱));
            return Convert.ToInt32(result ?? 0) > 0;
        }
        catch
        {
            return false;
        }
    }
}

/// <summary>
/// 操作紀錄輔助類別
/// </summary>
public static class 操作紀錄輔助
{
    public static void 記錄(int? 檔案編號, string 操作類型, string IP, 
                           string 操作結果 = "成功", string 失敗原因 = null, 
                           string 檔案名稱 = null, string 備註 = null)
    {
        try
        {
            string 主機名 = "";
            try { var entry = System.Net.Dns.GetHostEntry(IP); 主機名 = entry != null ? entry.HostName : ""; } catch { }

            string 登入帳號 = "";
            int? 帳號編號 = null;
            if (HttpContext.Current != null && HttpContext.Current.Session != null)
            {
                if (HttpContext.Current.Session["登入帳號"] != null)
                    登入帳號 = HttpContext.Current.Session["登入帳號"].ToString();
                if (HttpContext.Current.Session["帳號編號"] != null)
                    帳號編號 = Convert.ToInt32(HttpContext.Current.Session["帳號編號"]);
            }

            string sql = @"INSERT INTO [操作紀錄] 
                ([檔案編號],[帳號編號],[登入帳號],[操作類型],[操作者IP],[操作者主機名],[操作結果],[失敗原因],[檔案名稱],[備註])
                VALUES (@檔案編號,@帳號編號,@登入帳號,@操作類型,@操作者IP,@操作者主機名,@操作結果,@失敗原因,@檔案名稱,@備註)";

            if (資料庫輔助.欄位存在("操作紀錄", "登入帳號") && 資料庫輔助.欄位存在("操作紀錄", "帳號編號"))
            {
                資料庫輔助.執行(sql,
                    資料庫輔助.P("@檔案編號", (object)檔案編號 ?? DBNull.Value),
                    資料庫輔助.P("@帳號編號", (object)帳號編號 ?? DBNull.Value),
                    資料庫輔助.P("@登入帳號", 登入帳號),
                    資料庫輔助.P("@操作類型", 操作類型),
                    資料庫輔助.P("@操作者IP", IP),
                    資料庫輔助.P("@操作者主機名", 主機名),
                    資料庫輔助.P("@操作結果", 操作結果),
                    資料庫輔助.P("@失敗原因", 失敗原因),
                    資料庫輔助.P("@檔案名稱", 檔案名稱),
                    資料庫輔助.P("@備註", 備註)
                );
            }
            else
            {
                資料庫輔助.執行(@"INSERT INTO [操作紀錄]
                    ([檔案編號],[操作類型],[操作者IP],[操作者主機名],[操作結果],[失敗原因],[檔案名稱],[備註])
                    VALUES (@檔案編號,@操作類型,@操作者IP,@操作者主機名,@操作結果,@失敗原因,@檔案名稱,@備註)",
                    資料庫輔助.P("@檔案編號", (object)檔案編號 ?? DBNull.Value),
                    資料庫輔助.P("@操作類型", 操作類型),
                    資料庫輔助.P("@操作者IP", IP),
                    資料庫輔助.P("@操作者主機名", 主機名),
                    資料庫輔助.P("@操作結果", 操作結果),
                    資料庫輔助.P("@失敗原因", 失敗原因),
                    資料庫輔助.P("@檔案名稱", 檔案名稱),
                    資料庫輔助.P("@備註", 備註));
            }
        }
        catch { /* 紀錄失敗不影響主流程 */ }
    }

    public static void 記錄登入(string 帳號, string IP, string 操作結果, string 失敗原因 = null, string 備註 = null)
    {
        try
        {
            string 主機名 = "";
            try { var entry = System.Net.Dns.GetHostEntry(IP); 主機名 = entry != null ? entry.HostName : ""; } catch { }

            if (資料庫輔助.欄位存在("操作紀錄", "登入帳號") && 資料庫輔助.欄位存在("操作紀錄", "帳號編號"))
            {
                資料庫輔助.執行(@"INSERT INTO [操作紀錄]
                    ([檔案編號],[帳號編號],[登入帳號],[操作類型],[操作者IP],[操作者主機名],[操作結果],[失敗原因],[檔案名稱],[備註])
                    VALUES (NULL,NULL,@登入帳號,'登入',@操作者IP,@操作者主機名,@操作結果,@失敗原因,NULL,@備註)",
                    資料庫輔助.P("@登入帳號", 帳號),
                    資料庫輔助.P("@操作者IP", IP),
                    資料庫輔助.P("@操作者主機名", 主機名),
                    資料庫輔助.P("@操作結果", 操作結果),
                    資料庫輔助.P("@失敗原因", 失敗原因),
                    資料庫輔助.P("@備註", 備註));
            }
            else
            {
                資料庫輔助.執行(@"INSERT INTO [操作紀錄]
                    ([檔案編號],[操作類型],[操作者IP],[操作者主機名],[操作結果],[失敗原因],[檔案名稱],[備註])
                    VALUES (NULL,'登入',@操作者IP,@操作者主機名,@操作結果,@失敗原因,NULL,@備註)",
                    資料庫輔助.P("@操作者IP", IP),
                    資料庫輔助.P("@操作者主機名", 主機名),
                    資料庫輔助.P("@操作結果", 操作結果),
                    資料庫輔助.P("@失敗原因", 失敗原因),
                    資料庫輔助.P("@備註", string.Format("帳號={0}; {1}", 帳號, 備註 ?? "")));
            }
        }
        catch { }
    }

    public static void 資安警示(string 稽核類型, string 風險等級, string IP, string 目標資源, string 說明)
    {
        try
        {
            string sql = @"INSERT INTO [資安稽核紀錄] ([稽核類型],[風險等級],[來源IP],[目標資源],[事件描述])
                           VALUES (@稽核類型,@風險等級,@來源IP,@目標資源,@事件描述)";
            資料庫輔助.執行(sql,
                資料庫輔助.P("@稽核類型", 稽核類型),
                資料庫輔助.P("@風險等級", 風險等級),
                資料庫輔助.P("@來源IP", IP),
                資料庫輔助.P("@目標資源", 目標資源),
                資料庫輔助.P("@事件描述", 說明)
            );
        }
        catch { }
    }
}

/// <summary>
/// 民國日期輔助
/// </summary>
public static class 民國日期
{
    public static string 轉換(DateTime dt)
    {
        int 民國年 = dt.Year - 1911;
        return string.Format("民國{0}年{1:00}月{2:00}日 {3:00}:{4:00}:{5:00}", 民國年, dt.Month, dt.Day, dt.Hour, dt.Minute, dt.Second);
    }

    public static string 轉換日期(DateTime dt)
    {
        int 民國年 = dt.Year - 1911;
        return string.Format("民國{0}年{1:00}月{2:00}日", 民國年, dt.Month, dt.Day);
    }
}

/// <summary>
/// IP輔助
/// </summary>
public static class IP輔助
{
    public static string 取得用戶端IP()
    {
        var request = HttpContext.Current != null ? HttpContext.Current.Request : null;
        if (request == null) return "0.0.0.0";
        
        string ip = request.ServerVariables["HTTP_X_FORWARDED_FOR"];
        if (string.IsNullOrEmpty(ip)) ip = request.ServerVariables["REMOTE_ADDR"];
        if (string.IsNullOrEmpty(ip)) ip = request.UserHostAddress;
        
        // 取第一個IP (若有多個)
        if (ip != null && ip.Contains(","))
            ip = ip.Split(',')[0].Trim();
        
        return ip ?? "0.0.0.0";
    }

    public static bool 可上傳執行檔(string IP)
    {
        var dt = 資料庫輔助.查詢(
            "SELECT COUNT(*) FROM [執行檔IP白名單] WHERE [IP位址]=@IP AND [是否啟用]=1",
            資料庫輔助.P("@IP", IP));
        return Convert.ToInt32(dt.Rows[0][0]) > 0;
    }

    public static bool 是審核負責人(string IP, int 組別編號)
    {
        var dt = 資料庫輔助.查詢(
            "SELECT COUNT(*) FROM [組別設定] WHERE [組別編號]=@編號 AND ([負責人IP]=@IP OR [備用負責人IP]=@IP) AND [是否啟用]=1",
            資料庫輔助.P("@編號", 組別編號),
            資料庫輔助.P("@IP", IP));
        return Convert.ToInt32(dt.Rows[0][0]) > 0;
    }
}

/// <summary>
/// 個資偵測輔助
/// </summary>
public static class 個資偵測
{
    private static readonly System.Text.RegularExpressions.Regex 身分證規則 = 
        new System.Text.RegularExpressions.Regex(@"[A-Z][12]\d{8}", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly System.Text.RegularExpressions.Regex 電話規則 = 
        new System.Text.RegularExpressions.Regex(@"09\d{8}|0[2-8]\d{7,8}", System.Text.RegularExpressions.RegexOptions.Compiled);
    private static readonly System.Text.RegularExpressions.Regex 信箱規則 = 
        new System.Text.RegularExpressions.Regex(@"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}", System.Text.RegularExpressions.RegexOptions.Compiled);

    public static string 掃描檔名(string 檔名)
    {
        var 結果 = new System.Collections.Generic.List<string>();
        if (身分證規則.IsMatch(檔名)) 結果.Add("疑似身分證號碼");
        if (電話規則.IsMatch(檔名)) 結果.Add("疑似電話號碼");
        if (信箱規則.IsMatch(檔名)) 結果.Add("疑似電子郵件");
        return string.Join(",", 結果);
    }
}
