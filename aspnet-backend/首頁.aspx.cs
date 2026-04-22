using System;
using System.Data;
using System.Web.UI;

public partial class 首頁 : Page
{
    protected void Page_Load(object sender, EventArgs e)
    {
        if (Session["已登入"] == null) Response.Redirect("~/登入.aspx");
        if (!IsPostBack) 載入資料();
    }

    private void 載入資料()
    {
        // ── C3: 依角色決定統計範圍 ──
        bool 是管理員 = 角色輔助.是管理員();
        int? 我的組別 = 是管理員 ? (int?)null : 帳號輔助.取得組別編號();

        string 組別條件 = 是管理員 ? "" : " AND f.組別編號=@組別";
        var 組別參數 = 是管理員
            ? new System.Data.SqlClient.SqlParameter[0]
            : new[] { 資料庫輔助.P("@組別", 我的組別.Value) };

        // 統計數量（依角色範圍）
        var 統計 = 資料庫輔助.查詢(string.Format(@"
            SELECT
                SUM(CASE WHEN f.儲存區類型='永久區' AND f.是否刪除=0 THEN 1 ELSE 0 END) AS 永久區,
                SUM(CASE WHEN f.儲存區類型='時效區' AND f.是否刪除=0 THEN 1 ELSE 0 END) AS 時效區,
                SUM(CASE WHEN f.審核狀態='待審核' AND f.是否刪除=0 THEN 1 ELSE 0 END) AS 待審核,
                SUM(CASE WHEN f.儲存區類型='時效區' AND f.是否刪除=0
                         AND DATEDIFF(day,GETDATE(),f.到期時間) BETWEEN 0 AND 7 THEN 1 ELSE 0 END) AS 即將到期
            FROM 檔案主檔 f WHERE 1=1{0}", 組別條件), 組別參數);

        if (統計.Rows.Count > 0)
        {
            var r = 統計.Rows[0];
            lbl永久區數量.Text = r["永久區"] == DBNull.Value ? "0" : r["永久區"].ToString();
            lbl時效區數量.Text = r["時效區"] == DBNull.Value ? "0" : r["時效區"].ToString();
            lbl待審核數量.Text = r["待審核"] == DBNull.Value ? "0" : r["待審核"].ToString();
            lbl即將到期.Text   = r["即將到期"] == DBNull.Value ? "0" : r["即將到期"].ToString();
        }

        // 今日下載（依角色範圍）
        string 下載條件 = 是管理員 ? "" : @"
            AND EXISTS (SELECT 1 FROM 檔案主檔 f WHERE f.檔案編號=o.檔案編號 AND f.組別編號=@組別)";
        var 下載參數 = 是管理員
            ? new System.Data.SqlClient.SqlParameter[0]
            : new[] { 資料庫輔助.P("@組別", 我的組別.Value) };
        var 下載 = 資料庫輔助.查詢(string.Format(@"
            SELECT COUNT(*) AS 數量 FROM 操作紀錄 o
            WHERE o.操作類型='下載' AND CONVERT(date,o.操作時間)=CONVERT(date,GETDATE()){0}", 下載條件), 下載參數);
        lbl今日下載.Text = 下載.Rows.Count > 0 ? 下載.Rows[0]["數量"].ToString() : "0";

        // 未處理資安（僅管理員顯示全系統；非管理員隱藏或顯示0）
        if (是管理員)
        {
            var 資安 = 資料庫輔助.查詢(
                "SELECT COUNT(*) AS 數量 FROM 資安稽核紀錄 WHERE 處理狀態='未處理'");
            lbl未處理資安.Text = 資安.Rows.Count > 0 ? 資安.Rows[0]["數量"].ToString() : "0";
        }
        else
        {
            lbl未處理資安.Text = "-";
        }

        // 最近上傳（依角色範圍）
        var 上傳 = 資料庫輔助.查詢(string.Format(@"
            SELECT TOP 8 f.檔案編號, f.原始檔名, f.儲存區類型, f.上傳時間, f.副檔名, g.組別名稱,
                   ISNULL(u.姓名, f.上傳者IP) AS 上傳者姓名
            FROM 檔案主檔 f
            JOIN 組別設定 g ON f.組別編號=g.組別編號
            LEFT JOIN 使用者帳號 u ON f.上傳者IP=u.最後登入IP
            WHERE f.是否刪除=0{0}
            ORDER BY f.上傳時間 DESC", 組別條件), 組別參數);
        rpt最近上傳.DataSource = 上傳;
        rpt最近上傳.DataBind();

        // ── C1: 最近操作補帳號姓名（JOIN 使用者帳號）──
        string 操作條件 = 是管理員 ? "" : @"
            AND EXISTS (SELECT 1 FROM 檔案主檔 f WHERE f.檔案編號=o.檔案編號 AND f.組別編號=@組別)";
        var 操作參數 = 是管理員
            ? new System.Data.SqlClient.SqlParameter[0]
            : new[] { 資料庫輔助.P("@組別", 我的組別.Value) };
        var 操作 = 資料庫輔助.查詢(string.Format(@"
            SELECT TOP 10 o.操作類型, o.操作者IP, o.操作時間, o.檔案名稱,
                   ISNULL(u.姓名, o.操作者IP) AS 操作者姓名
            FROM 操作紀錄 o
            LEFT JOIN 使用者帳號 u ON o.操作者IP=u.最後登入IP
            WHERE 1=1{0}
            ORDER BY o.操作時間 DESC", 操作條件), 操作參數);
        rpt最近紀錄.DataSource = 操作;
        rpt最近紀錄.DataBind();

        // 即將到期（依角色範圍）
        var 到期 = 資料庫輔助.查詢(string.Format(@"
            SELECT f.檔案編號, f.原始檔名, f.到期時間, g.組別名稱,
                   DATEDIFF(day,GETDATE(),f.到期時間) AS 剩餘天數
            FROM 檔案主檔 f JOIN 組別設定 g ON f.組別編號=g.組別編號
            WHERE f.儲存區類型='時效區' AND f.是否刪除=0
                  AND DATEDIFF(day,GETDATE(),f.到期時間) BETWEEN 0 AND 7{0}
            ORDER BY f.到期時間", 組別條件), 組別參數);
        gv即將到期.DataSource = 到期;
        gv即將到期.DataBind();
    }

    protected string 取得檔案圖示(string 副檔名)
    {
        if (string.IsNullOrEmpty(副檔名)) return "fa-file";
        switch (副檔名.ToLower().TrimStart('.'))
        {
            case "pdf": return "fa-file-pdf";
            case "doc": case "docx": return "fa-file-word";
            case "xls": case "xlsx": return "fa-file-excel";
            case "ppt": case "pptx": return "fa-file-powerpoint";
            case "jpg": case "jpeg": case "png": case "gif": case "bmp": return "fa-file-image";
            case "zip": case "rar": case "7z": return "fa-file-archive";
            case "txt": return "fa-file-alt";
            case "mp4": case "avi": case "mov": return "fa-file-video";
            default: return "fa-file";
        }
    }

    protected string 取得操作顏色(string 操作類型)
    {
        switch (操作類型)
        {
            case "上傳": return "#2e7d52";
            case "下載": return "#1a3a6b";
            case "預覽": return "#7c3aed";
            case "編輯": return "#e67e22";
            case "刪除": return "#dc2626";
            case "審核": return "#e8a020";
            default: return "#9ca3af";
        }
    }
}
