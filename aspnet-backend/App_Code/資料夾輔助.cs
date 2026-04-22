using System;
using System.Data;
using System.IO;
using System.Web;

/// <summary>
/// 樹狀資料夾管理輔助類別
/// </summary>
public static class 資料夾輔助
{
    // ── 查詢 ──────────────────────────────────────────────────

    /// <summary>取得指定資料夾的直接子資料夾</summary>
    public static DataTable 取得子資料夾(int? 父資料夾編號, int? 組別編號 = null, string 儲存區 = null)
    {
        string sql;
        System.Data.SqlClient.SqlParameter[] 參數;

        if (父資料夾編號 == null)
        {
            sql = @"SELECT f.資料夾編號, f.資料夾名稱, f.實體路徑, f.建立時間, f.組別編號,
                           f.儲存區類型, g.組別名稱,
                           (SELECT COUNT(*) FROM 資料夾 c WHERE c.父資料夾編號=f.資料夾編號 AND c.是否刪除=0) AS 子資料夾數,
                           (SELECT COUNT(*) FROM 檔案主檔 m WHERE m.資料夾編號=f.資料夾編號 AND m.是否刪除=0) AS 檔案數
                    FROM 資料夾 f JOIN 組別設定 g ON f.組別編號=g.組別編號
                    WHERE f.父資料夾編號 IS NULL AND f.是否刪除=0
                      AND (@組別編號 IS NULL OR f.組別編號=@組別編號)
                      AND (@儲存區 IS NULL OR f.儲存區類型=@儲存區)
                    ORDER BY g.組別編號, f.儲存區類型";
            參數 = new[] {
                資料庫輔助.P("@組別編號", (object)組別編號 ?? DBNull.Value),
                資料庫輔助.P("@儲存區",   (object)儲存區   ?? DBNull.Value)
            };
        }
        else
        {
            sql = @"SELECT f.資料夾編號, f.資料夾名稱, f.實體路徑, f.建立時間, f.組別編號,
                           f.儲存區類型, g.組別名稱,
                           (SELECT COUNT(*) FROM 資料夾 c WHERE c.父資料夾編號=f.資料夾編號 AND c.是否刪除=0) AS 子資料夾數,
                           (SELECT COUNT(*) FROM 檔案主檔 m WHERE m.資料夾編號=f.資料夾編號 AND m.是否刪除=0) AS 檔案數
                    FROM 資料夾 f JOIN 組別設定 g ON f.組別編號=g.組別編號
                    WHERE f.父資料夾編號=@父編號 AND f.是否刪除=0
                    ORDER BY f.資料夾名稱";
            參數 = new[] { 資料庫輔助.P("@父編號", 父資料夾編號.Value) };
        }
        return 資料庫輔助.查詢(sql, 參數);
    }

    /// <summary>取得資料夾內的檔案</summary>
    public static DataTable 取得資料夾檔案(int 資料夾編號)
    {
        return 資料庫輔助.查詢(@"
            SELECT f.檔案編號, f.原始檔名, f.副檔名, f.檔案大小, f.上傳時間,
                   f.儲存區類型, f.審核狀態, f.到期時間, f.上傳者IP, f.描述,
                   g.組別名稱
            FROM 檔案主檔 f JOIN 組別設定 g ON f.組別編號=g.組別編號
            WHERE f.資料夾編號=@編號 AND f.是否刪除=0
            ORDER BY f.上傳時間 DESC",
            資料庫輔助.P("@編號", 資料夾編號));
    }

    /// <summary>取得麵包屑路徑</summary>
    public static DataTable 取得麵包屑(int 資料夾編號)
    {
        return 資料庫輔助.查詢(@"
            WITH 路徑CTE AS (
                SELECT 資料夾編號, 資料夾名稱, 父資料夾編號, 0 AS 層級
                FROM 資料夾 WHERE 資料夾編號=@編號
                UNION ALL
                SELECT f.資料夾編號, f.資料夾名稱, f.父資料夾編號, c.層級+1
                FROM 資料夾 f INNER JOIN 路徑CTE c ON f.資料夾編號=c.父資料夾編號
            )
            SELECT 資料夾編號, 資料夾名稱 FROM 路徑CTE ORDER BY 層級 DESC",
            資料庫輔助.P("@編號", 資料夾編號));
    }

    /// <summary>取得單一資料夾資訊</summary>
    public static DataRow 取得資料夾資訊(int 資料夾編號)
    {
        var dt = 資料庫輔助.查詢(@"
            SELECT f.*, g.組別名稱, g.組別代碼
            FROM 資料夾 f JOIN 組別設定 g ON f.組別編號=g.組別編號
            WHERE f.資料夾編號=@編號",
            資料庫輔助.P("@編號", 資料夾編號));
        return dt.Rows.Count > 0 ? dt.Rows[0] : null;
    }

    // ── 建立 ──────────────────────────────────────────────────

    /// <summary>建立新資料夾（DB + 實體磁碟）</summary>
    public static int 建立資料夾(int? 父資料夾編號, int 組別編號, string 儲存區類型,
                                  string 資料夾名稱, string 建立者IP)
    {
        資料夾名稱 = 清理資料夾名稱(資料夾名稱);
        if (string.IsNullOrEmpty(資料夾名稱))
            throw new Exception("資料夾名稱不合法");

        string 父路徑;
        if (父資料夾編號 == null)
        {
            var 組別 = 資料庫輔助.查詢("SELECT 組別代碼 FROM 組別設定 WHERE 組別編號=@編號",
                資料庫輔助.P("@編號", 組別編號));
            string 根路徑 = 儲存區類型 == "永久區"
                ? System.Configuration.ConfigurationManager.AppSettings["永久區路徑"]
                : System.Configuration.ConfigurationManager.AppSettings["時效區路徑"];
            父路徑 = Path.Combine(根路徑, 組別.Rows[0]["組別代碼"].ToString());
        }
        else
        {
            var 父 = 取得資料夾資訊(父資料夾編號.Value);
            if (父 == null) throw new Exception("父資料夾不存在");
            父路徑 = 父["實體路徑"].ToString();
        }

        string 實體路徑 = Path.Combine(父路徑, 資料夾名稱);
        Directory.CreateDirectory(實體路徑);

        object 新編號 = 資料庫輔助.查詢單值(@"
            INSERT INTO 資料夾 (父資料夾編號, 組別編號, 儲存區類型, 資料夾名稱, 實體路徑, 建立者IP)
            VALUES (@父, @組別, @儲存區, @名稱, @路徑, @IP);
            SELECT SCOPE_IDENTITY();",
            資料庫輔助.P("@父",   (object)父資料夾編號 ?? DBNull.Value),
            資料庫輔助.P("@組別", 組別編號),
            資料庫輔助.P("@儲存區", 儲存區類型),
            資料庫輔助.P("@名稱", 資料夾名稱),
            資料庫輔助.P("@路徑", 實體路徑),
            資料庫輔助.P("@IP",   建立者IP));

        int id = Convert.ToInt32(新編號);
        操作紀錄輔助.記錄(null, "建立資料夾", 建立者IP, "成功", null, null,
            string.Format("建立資料夾: {0} ({1})", 資料夾名稱, 實體路徑));
        return id;
    }

    // ── 改名（B1：同步實體路徑與子資料夾/子檔案路徑）────────────

    /// <summary>
    /// 重新命名資料夾：同步更新實體磁碟路徑、DB 中此資料夾及所有子孫的實體路徑、
    /// 以及所有子孫檔案的 檔案路徑。
    /// </summary>
    public static bool 重新命名資料夾(int 資料夾編號, string 新名稱, string 操作者IP)
    {
        新名稱 = 清理資料夾名稱(新名稱);
        if (string.IsNullOrEmpty(新名稱)) return false;

        var info = 取得資料夾資訊(資料夾編號);
        if (info == null) return false;

        string 舊路徑 = info["實體路徑"].ToString();
        string 父路徑 = Path.GetDirectoryName(舊路徑);
        string 新路徑 = Path.Combine(父路徑, 新名稱);

        if (string.Equals(舊路徑, 新路徑, StringComparison.OrdinalIgnoreCase))
            return true; // 名稱未變，直接成功

        // 1. 實體磁碟改名
        try
        {
            if (Directory.Exists(舊路徑))
                Directory.Move(舊路徑, 新路徑);
        }
        catch (Exception ex)
        {
            操作紀錄輔助.資安警示("資料夾改名失敗", "中", 操作者IP,
                舊路徑, string.Format("實體改名失敗: {0}", ex.Message));
            return false;
        }

        // 2. 更新 DB：此資料夾名稱與路徑
        資料庫輔助.執行(
            "UPDATE 資料夾 SET 資料夾名稱=@名稱, 實體路徑=@路徑 WHERE 資料夾編號=@id",
            資料庫輔助.P("@名稱", 新名稱),
            資料庫輔助.P("@路徑", 新路徑),
            資料庫輔助.P("@id",   資料夾編號));

        // 3. 遞迴更新所有子孫資料夾與檔案的路徑（字串取代）
        更新子孫路徑(資料夾編號, 舊路徑, 新路徑);

        // 4. 寫操作紀錄
        操作紀錄輔助.記錄(null, "建立資料夾", 操作者IP, "成功", null, null,
            string.Format("重新命名資料夾: {0} → {1}", 舊路徑, 新路徑));

        return true;
    }

    /// <summary>遞迴更新子孫資料夾與檔案的實體路徑</summary>
    private static void 更新子孫路徑(int 資料夾編號, string 舊前綴, string 新前綴)
    {
        var 子們 = 資料庫輔助.查詢(
            "SELECT 資料夾編號, 實體路徑 FROM 資料夾 WHERE 父資料夾編號=@編號 AND 是否刪除=0",
            資料庫輔助.P("@編號", 資料夾編號));

        foreach (DataRow r in 子們.Rows)
        {
            string 子舊路徑 = r["實體路徑"].ToString();
            string 子新路徑 = 新前綴 + 子舊路徑.Substring(舊前綴.Length);
            int 子id = Convert.ToInt32(r["資料夾編號"]);

            資料庫輔助.執行(
                "UPDATE 資料夾 SET 實體路徑=@路徑 WHERE 資料夾編號=@id",
                資料庫輔助.P("@路徑", 子新路徑),
                資料庫輔助.P("@id",   子id));

            // 更新此子資料夾內的檔案路徑
            資料庫輔助.執行(@"
                UPDATE 檔案主檔 SET 檔案路徑 = @新前綴 + SUBSTRING(檔案路徑, LEN(@舊前綴)+1, LEN(檔案路徑))
                WHERE 資料夾編號=@fid AND 是否刪除=0",
                資料庫輔助.P("@新前綴", 子新路徑 + "\\"),
                資料庫輔助.P("@舊前綴", 子舊路徑 + "\\"),
                資料庫輔助.P("@fid",    子id));

            更新子孫路徑(子id, 子舊路徑, 子新路徑);
        }

        // 更新本資料夾內的檔案路徑
        資料庫輔助.執行(@"
            UPDATE 檔案主檔 SET 檔案路徑 = @新前綴 + SUBSTRING(檔案路徑, LEN(@舊前綴)+1, LEN(檔案路徑))
            WHERE 資料夾編號=@fid AND 是否刪除=0",
            資料庫輔助.P("@新前綴", 新前綴 + "\\"),
            資料庫輔助.P("@舊前綴", 舊前綴 + "\\"),
            資料庫輔助.P("@fid",    資料夾編號));
    }

    // ── 刪除（移入回收桶）────────────────────────────────────

    /// <summary>遞迴將資料夾及其下所有子資料夾與檔案移入回收桶</summary>
    public static void 刪除資料夾(int 資料夾編號, string 操作者IP)
    {
        var info = 取得資料夾資訊(資料夾編號);
        if (info == null) return;
        string 原路徑 = info["實體路徑"].ToString();

        標記資料夾刪除遞迴(資料夾編號, 操作者IP);

        try
        {
            string 回收路徑 = System.Configuration.ConfigurationManager.AppSettings["資源回收桶路徑"];
            string 目標 = Path.Combine(回收路徑,
                string.Format("{0}_{1:yyyyMMddHHmmss}", Path.GetFileName(原路徑), DateTime.Now));
            if (Directory.Exists(原路徑))
                Directory.Move(原路徑, 目標);
        }
        catch { /* 實體移動失敗不影響DB標記 */ }

        操作紀錄輔助.記錄(null, "刪除資料夾", 操作者IP, "成功", null, null,
            string.Format("刪除資料夾: {0}", 原路徑));
    }

    private static void 標記資料夾刪除遞迴(int 資料夾編號, string IP)
    {
        var 子們 = 資料庫輔助.查詢(
            "SELECT 資料夾編號 FROM 資料夾 WHERE 父資料夾編號=@編號 AND 是否刪除=0",
            資料庫輔助.P("@編號", 資料夾編號));
        foreach (DataRow r in 子們.Rows)
            標記資料夾刪除遞迴(Convert.ToInt32(r[0]), IP);

        資料庫輔助.執行(@"UPDATE 檔案主檔 SET 儲存區類型='資源回收桶',
                          刪除時間=GETDATE(), 刪除者IP=@IP
                          WHERE 資料夾編號=@編號 AND 是否刪除=0",
            資料庫輔助.P("@IP", IP),
            資料庫輔助.P("@編號", 資料夾編號));

        資料庫輔助.執行(@"UPDATE 資料夾 SET 是否刪除=1, 刪除時間=GETDATE(), 刪除者IP=@IP
                          WHERE 資料夾編號=@編號",
            資料庫輔助.P("@IP", IP),
            資料庫輔助.P("@編號", 資料夾編號));
    }

    // ── 工具 ─────────────────────────────────────────────────

    public static string 清理資料夾名稱(string 名稱)
    {
        if (string.IsNullOrWhiteSpace(名稱)) return "";
        foreach (char c in Path.GetInvalidFileNameChars())
            名稱 = 名稱.Replace(c.ToString(), "");
        return 名稱.Trim().TrimEnd('.');
    }

    /// <summary>產生資料夾 JSON 樹（給前端 treeview 用）</summary>
    public static string 產生樹JSON(int? 父資料夾編號, int? 組別編號, string 儲存區)
    {
        var dt = 取得子資料夾(父資料夾編號, 組別編號, 儲存區);
        var sb = new System.Text.StringBuilder();
        sb.Append("[");
        for (int i = 0; i < dt.Rows.Count; i++)
        {
            var r = dt.Rows[i];
            if (i > 0) sb.Append(",");
            sb.Append("{");
            sb.Append(string.Format("\"id\":{0},", r["資料夾編號"]));
            sb.Append(string.Format("\"text\":\"{0}\",", r["資料夾名稱"].ToString().Replace("\"", "\\\"")));
            sb.Append(string.Format("\"children\":{0},", Convert.ToInt32(r["子資料夾數"]) > 0 ? "true" : "false"));
            sb.Append(string.Format("\"files\":{0},", r["檔案數"]));
            sb.Append(string.Format("\"type\":\"{0}\"", r["儲存區類型"]));
            sb.Append("}");
        }
        sb.Append("]");
        return sb.ToString();
    }
}
