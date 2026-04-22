using System;
using System.Data;

public partial class 檔案瀏覽 : System.Web.UI.Page
{
    private string 目前Zone { get { return Request.QueryString["zone"] ?? (Session["zone"] != null ? Session["zone"].ToString() : "永久區"); } }
    private string 目前FidStr { get { return Request.QueryString["fid"] ?? ""; } }
    private int? 目前Fid { get { int v; return int.TryParse(目前FidStr, out v) ? (int?)v : null; } }

    protected void Page_Load(object sender, EventArgs e)
    {
        if (Session["已登入"] == null) Response.Redirect("~/登入.aspx");
        if (!權限輔助.可查看儲存區(目前Zone))
        {
            Response.Redirect("~/首頁.aspx?msg=權限不足", false);
            return;
        }

        if (目前Fid.HasValue)
        {
            var 目前資料夾 = 資料夾輔助.取得資料夾資訊(目前Fid.Value);
            if (!權限輔助.可存取資料夾(目前資料夾))
            {
                Response.Redirect("~/首頁.aspx?msg=無法存取該資料夾", false);
                return;
            }
        }

        if (!string.IsNullOrEmpty(Request.QueryString["zone"])) Session["zone"] = Request.QueryString["zone"];
        if (!IsPostBack) 載入頁面();
    }

    private void 載入頁面()
    {
        litFid.Text  = 目前FidStr;
        litZone.Text = 目前Zone;
        更新麵包屑();
        載入內容();
    }

    private void 更新麵包屑()
    {
        if (目前Fid == null) { litBC.Text = string.Format(" <span class='bc-sep'>›</span> <span class='bc-cur'>{0}</span>", 目前Zone); return; }
        var dt = 資料夾輔助.取得麵包屑(目前Fid.Value);
        var sb = new System.Text.StringBuilder();
        sb.AppendFormat(" <span class='bc-sep'>›</span> <button class='bc-link' onclick=\"navTo('')\">{0}</button>", 目前Zone);
        foreach (DataRow r in dt.Rows)
        {
            sb.Append(" <span class='bc-sep'>›</span> ");
            bool isCur = r["資料夾編號"].ToString() == 目前FidStr;
            if (isCur)
                sb.AppendFormat("<span class='bc-cur'>{0}</span>", r["資料夾名稱"]);
            else
                sb.AppendFormat("<button class='bc-link' onclick='navTo({0})'>{1}</button>", r["資料夾編號"], r["資料夾名稱"]);
        }
        litBC.Text = sb.ToString();
    }

    private void 載入內容()
    {
        DataTable 資料夾dt;
        DataTable 檔案dt;

        if (目前Fid == null)
        {
            資料夾dt = 資料庫輔助.查詢(@"
                SELECT f.資料夾編號, f.資料夾名稱, f.建立時間,
                       ISNULL(u.姓名,'系統') AS 建立者,
                       (SELECT COUNT(*) FROM 資料夾 c WHERE c.父資料夾編號=f.資料夾編號 AND c.是否刪除=0) +
                       (SELECT COUNT(*) FROM 檔案主檔 m WHERE m.資料夾編號=f.資料夾編號 AND m.是否刪除=0) AS 子項目數
                FROM 資料夾 f
                LEFT JOIN 使用者帳號 u ON f.建立者IP=u.最後登入IP
                WHERE f.父資料夾編號 IS NULL AND f.是否刪除=0 AND f.儲存區類型=@zone
                  AND (@組別編號 IS NULL OR f.組別編號=@組別編號)
                ORDER BY f.資料夾名稱",
                資料庫輔助.P("@zone", 目前Zone),
                資料庫輔助.P("@組別編號", 角色輔助.是管理員() ? (object)DBNull.Value : (object)帳號輔助.取得組別編號()));
            檔案dt = new DataTable();
        }
        else
        {
            資料夾dt = 資料庫輔助.查詢(@"
                SELECT f.資料夾編號, f.資料夾名稱, f.建立時間,
                       ISNULL(u.姓名,'系統') AS 建立者,
                       (SELECT COUNT(*) FROM 資料夾 c WHERE c.父資料夾編號=f.資料夾編號 AND c.是否刪除=0) +
                       (SELECT COUNT(*) FROM 檔案主檔 m WHERE m.資料夾編號=f.資料夾編號 AND m.是否刪除=0) AS 子項目數
                FROM 資料夾 f
                LEFT JOIN 使用者帳號 u ON f.建立者IP=u.最後登入IP
                WHERE f.父資料夾編號=@fid AND f.是否刪除=0
                ORDER BY f.資料夾名稱",
                資料庫輔助.P("@fid", 目前Fid.Value));

            string where = "WHERE f.資料夾編號=@fid AND f.是否刪除=0 AND f.儲存區類型 != '資源回收桶'";
            if (!角色輔助.是管理員())
            {
                where += " AND f.組別編號=@組別";
                if (角色輔助.是外包())
                    where += " AND f.儲存區類型='時效區'";
                else if (目前Zone == "永久區" && !角色輔助.是本組負責人(Convert.ToInt32(資料夾輔助.取得資料夾資訊(目前Fid.Value)["組別編號"])))
                    where += " AND f.審核狀態='已通過'";
            }
            檔案dt = 資料庫輔助.查詢(string.Format(@"
                SELECT f.檔案編號, f.原始檔名, f.副檔名, f.檔案大小, f.上傳時間,
                       f.儲存區類型, f.審核狀態, f.到期時間, f.組別編號,
                       g.組別名稱, ISNULL(u.姓名, f.上傳者IP) AS 上傳者姓名
                FROM 檔案主檔 f
                JOIN 組別設定 g ON f.組別編號=g.組別編號
                LEFT JOIN 使用者帳號 u ON f.上傳者IP=u.最後登入IP
                {0} ORDER BY f.上傳時間 DESC", where),
                資料庫輔助.P("@fid", 目前Fid.Value),
                資料庫輔助.P("@組別", (object)帳號輔助.取得組別編號() ?? DBNull.Value));
        }

        lbl資料夾數.Text = 資料夾dt.Rows.Count.ToString();
        lbl檔案數.Text   = 檔案dt.Rows.Count.ToString();
        pnlEmpty.Visible = 資料夾dt.Rows.Count == 0 && 檔案dt.Rows.Count == 0;

        rptFolders.DataSource   = 資料夾dt; rptFolders.DataBind();
        rptFilesGrid.DataSource = 檔案dt;   rptFilesGrid.DataBind();
        rptFilesList.DataSource = 檔案dt;   rptFilesList.DataBind();
    }

    protected void btnPB_Click(object sender, EventArgs e)
    {
        string act  = hfAct.Value;
        string data = hfData.Value;
        string IP   = IP輔助.取得用戶端IP();

        if (act == "newFolder" && 目前Fid.HasValue)
        {
            var p = data.Split(new char[]{'|'}, 2);
            if (p.Length == 2)
            {
                var info = 資料夾輔助.取得資料夾資訊(目前Fid.Value);
                if (info != null && 權限輔助.可存取資料夾(info, true))
                    資料夾輔助.建立資料夾(目前Fid.Value, Convert.ToInt32(info["組別編號"]),
                        info["儲存區類型"].ToString(), p[1].Trim(), IP);
            }
        }
        else if (act == "rename")
        {
            // ── B1: 改呼叫新方法，同步實體路徑與子孫路徑，並補寫操作紀錄 ──
            var p = data.Split(new char[]{'|'}, 2);
            if (p.Length == 2)
            {
                int targetId = int.Parse(p[0]);
                string 新名稱 = p[1].Trim();
                var info = 資料夾輔助.取得資料夾資訊(targetId);
                if (info != null && 權限輔助.可存取資料夾(info, true))
                {
                    bool ok = 資料夾輔助.重新命名資料夾(targetId, 新名稱, IP);
                    if (!ok)
                    {
                        // 改名失敗（例如磁碟錯誤），可在此加入前端提示機制
                    }
                }
            }
        }
        else if (act == "delFolder")
        {
            int fid = int.Parse(data);
            var info = 資料夾輔助.取得資料夾資訊(fid);
            if (info != null && info["父資料夾編號"] != DBNull.Value && 權限輔助.可存取資料夾(info, true))
                資料夾輔助.刪除資料夾(fid, IP);
        }
        else if (act == "delFile")
        {
            int fid = int.Parse(data);
            var dt = 資料庫輔助.查詢("SELECT 儲存區類型, 組別編號, 審核狀態 FROM 檔案主檔 WHERE 檔案編號=@id", 資料庫輔助.P("@id", fid));
            if (dt.Rows.Count > 0)
            {
                var row = dt.Rows[0];
                if (權限輔助.可存取檔案(row, true))
                {
                    資料庫輔助.執行(@"UPDATE 檔案主檔 SET 儲存區類型='資源回收桶', 刪除時間=GETDATE(), 刪除者IP=@IP WHERE 檔案編號=@id",
                        資料庫輔助.P("@IP", IP), 資料庫輔助.P("@id", fid));
                    操作紀錄輔助.記錄(fid, "刪除", IP, "成功");
                }
            }
        }

        string url = "檔案瀏覽.aspx?zone=" + Server.UrlEncode(目前Zone);
        if (目前Fid.HasValue) url += "&fid=" + 目前FidStr;
        Response.Redirect(url, false);
    }

    protected string 取得圖示(string ext)
    {
        if (string.IsNullOrEmpty(ext)) return "📄";
        switch (ext.ToLower().TrimStart('.'))
        {
            case "pdf": return "📕"; case "doc": case "docx": return "📘";
            case "xls": case "xlsx": return "📗"; case "ppt": case "pptx": return "📙";
            case "jpg": case "jpeg": case "png": case "gif": return "🖼️";
            case "zip": case "rar": case "7z": return "📦"; case "txt": return "📝";
            case "mp4": case "avi": return "🎬"; case "py": case "js": case "cs": return "💻";
            default: return "📄";
        }
    }

    protected string 格式化大小(object 大小)
    {
        if (大小 == DBNull.Value || 大小 == null) return "-";
        long b = Convert.ToInt64(大小);
        if (b < 1024) return b + " B";
        if (b < 1048576) return string.Format("{0:F0} KB", b / 1024.0);
        return string.Format("{0:F1} MB", b / 1048576.0);
    }

    protected string 取得狀態Badge(string 審核狀態, object 到期時間, string 儲存區)
    {
        if (儲存區 == "永久區")
        {
            if (審核狀態 == "已通過") return "<span class='fm-badge b-ok'>✓ 已審核</span>";
            if (審核狀態 == "待審核") return "<span class='fm-badge b-wait'>⏳ 待審</span>";
            if (審核狀態 == "未通過") return "<span class='fm-badge b-red'>✗ 未通過</span>";
            return "";
        }
        if (到期時間 == DBNull.Value || 到期時間 == null) return "";
        int 剩 = (int)(Convert.ToDateTime(到期時間) - DateTime.Now).TotalDays;
        if (剩 <= 0) return "<span class='fm-badge b-red'>剩餘0天</span>";
        if (剩 <= 7) return string.Format("<span class='fm-badge b-red'>剩餘{0}天</span>", 剩);
        if (剩 <= 14) return string.Format("<span class='fm-badge b-wait'>剩餘{0}天</span>", 剩);
        return string.Format("<span class='fm-badge b-ok'>剩餘{0}天</span>", 剩);
    }
}
