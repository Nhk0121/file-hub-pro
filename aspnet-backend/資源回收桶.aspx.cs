using System;
using System.Data;
using System.IO;
using System.Web.UI.WebControls;

public partial class 資源回收桶 : System.Web.UI.Page
{
    protected void Page_Load(object sender, EventArgs e)
    {
        if (Session["已登入"] == null) Response.Redirect("~/登入.aspx");
        if (!角色輔助.要求管理員(this)) return;
        if (!IsPostBack) { 載入組別(); 查詢(); }
    }

    private void 載入組別()
    {
        var dt = 資料庫輔助.查詢("SELECT 組別編號, 組別名稱 FROM 組別設定 WHERE 是否啟用=1 ORDER BY 組別編號");
        dd篩選組別.DataSource = dt;
        dd篩選組別.DataTextField = "組別名稱";
        dd篩選組別.DataValueField = "組別編號";
        dd篩選組別.DataBind();
        dd篩選組別.Items.Insert(0, new ListItem("全部組別", ""));
    }

    private void 查詢()
    {
        string where = "WHERE f.儲存區類型='資源回收桶' AND f.是否刪除=0";
        var 參數 = new System.Collections.Generic.List<System.Data.SqlClient.SqlParameter>();

        if (!string.IsNullOrEmpty(dd篩選組別.SelectedValue))
        {
            where += " AND f.組別編號=@組別";
            參數.Add(資料庫輔助.P("@組別", int.Parse(dd篩選組別.SelectedValue)));
        }
        if (!string.IsNullOrEmpty(txt搜尋.Text.Trim()))
        {
            where += " AND f.原始檔名 LIKE @kw";
            參數.Add(資料庫輔助.P("@kw", "%" + txt搜尋.Text.Trim() + "%"));
        }

        var dt = 資料庫輔助.查詢(string.Format(@"
            SELECT f.檔案編號, f.原始檔名, f.檔案大小, f.刪除時間, f.刪除者IP,
                   f.檔案路徑, f.儲存檔名, f.組別編號, g.組別名稱, g.組別代碼,
                   ISNULL(fd.資料夾名稱, '') AS 資料夾路徑,
                   DATEDIFF(day, GETDATE(), DATEADD(day,60,f.刪除時間)) AS 剩餘天數
            FROM 檔案主檔 f
            JOIN 組別設定 g ON f.組別編號=g.組別編號
            LEFT JOIN 資料夾 fd ON f.資料夾編號=fd.資料夾編號
            {0} ORDER BY f.刪除時間 DESC", where), 參數.ToArray());

        lbl筆數.Text = dt.Rows.Count.ToString();
        gv回收桶.DataSource = dt;
        gv回收桶.DataBind();
    }

    protected void 重新查詢(object sender, EventArgs e) { 查詢(); }

    protected void gv_RowCommand(object sender, GridViewCommandEventArgs e)
    {
        int 編號 = int.Parse(e.CommandArgument.ToString());
        string IP = IP輔助.取得用戶端IP();

        if (e.CommandName == "還原")
        {
            // ── B2: 還原時補實體移檔回時效區，並從設定讀取天數 ──
            int 天數;
            int.TryParse(System.Configuration.ConfigurationManager.AppSettings["時效區天數"], out 天數);
            if (天數 <= 0) 天數 = 30;

            // 取得檔案資訊以進行實體移檔
            var 檔案dt = 資料庫輔助.查詢(
                "SELECT 檔案路徑, 儲存檔名, 組別編號, 組別代碼 FROM 檔案主檔 f JOIN 組別設定 g ON f.組別編號=g.組別編號 WHERE f.檔案編號=@編號",
                資料庫輔助.P("@編號", 編號));

            if (檔案dt.Rows.Count == 0) return;
            var 檔案row = 檔案dt.Rows[0];
            string 舊路徑 = 檔案row["檔案路徑"].ToString();
            string 組別代碼 = 檔案row["組別代碼"].ToString();
            string 儲存檔名 = 檔案row["儲存檔名"].ToString();

            // 計算時效區目標路徑
            string 時效根路徑 = System.Configuration.ConfigurationManager.AppSettings["時效區路徑"];
            string 時效組別路徑 = Path.Combine(時效根路徑, 組別代碼);
            string 新路徑 = Path.Combine(時效組別路徑, 儲存檔名);

            bool 移檔成功 = false;
            try
            {
                Directory.CreateDirectory(時效組別路徑);
                if (File.Exists(舊路徑))
                {
                    File.Move(舊路徑, 新路徑);
                    移檔成功 = true;
                }
                else if (!File.Exists(舊路徑))
                {
                    // 實體檔案已不存在，仍允許 DB 還原（避免殭屍紀錄）
                    新路徑 = 舊路徑;
                    移檔成功 = true;
                }
            }
            catch (Exception ex)
            {
                操作紀錄輔助.資安警示("回收桶還原移檔失敗", "中", IP,
                    舊路徑, string.Format("實體移檔失敗: {0}", ex.Message));
                新路徑 = 舊路徑; // 維持原路徑，不更新 DB 路徑
            }

            if (移檔成功)
            {
                資料庫輔助.執行(@"UPDATE 檔案主檔 SET 儲存區類型='時效區',
                                  到期時間=DATEADD(day,@天數,GETDATE()),
                                  刪除時間=NULL, 刪除者IP=NULL,
                                  檔案路徑=@新路徑
                                  WHERE 檔案編號=@編號",
                    資料庫輔助.P("@天數", 天數),
                    資料庫輔助.P("@新路徑", 新路徑),
                    資料庫輔助.P("@編號", 編號));
                操作紀錄輔助.記錄(編號, "還原", IP, "成功", null, null,
                    string.Format("還原至時效區，到期 {0} 天後", 天數));
            }
            else
            {
                // 移檔失敗，不執行還原，告知操作者
                操作紀錄輔助.記錄(編號, "還原", IP, "失敗", "實體移檔失敗，還原取消");
            }
        }
        else if (e.CommandName == "永久刪除")
        {
            var dt = 資料庫輔助.查詢("SELECT 檔案路徑 FROM 檔案主檔 WHERE 檔案編號=@編號",
                資料庫輔助.P("@編號", 編號));
            if (dt.Rows.Count > 0)
            {
                string 路徑 = dt.Rows[0]["檔案路徑"].ToString();
                try { if (File.Exists(路徑)) File.Delete(路徑); } catch { }
            }
            資料庫輔助.執行("UPDATE 檔案主檔 SET 是否刪除=1 WHERE 檔案編號=@編號",
                資料庫輔助.P("@編號", 編號));
            操作紀錄輔助.記錄(編號, "永久刪除", IP, "成功");
        }
        查詢();
    }

    protected void btn清空_Click(object sender, EventArgs e)
    {
        string IP = IP輔助.取得用戶端IP();
        var dt = 資料庫輔助.查詢(
            "SELECT 檔案編號, 檔案路徑 FROM 檔案主檔 WHERE 儲存區類型='資源回收桶' AND 是否刪除=0");
        foreach (DataRow r in dt.Rows)
        {
            try { if (File.Exists(r["檔案路徑"].ToString())) File.Delete(r["檔案路徑"].ToString()); } catch { }
        }
        資料庫輔助.執行(
            "UPDATE 檔案主檔 SET 是否刪除=1 WHERE 儲存區類型='資源回收桶' AND 是否刪除=0");
        操作紀錄輔助.記錄(null, "清空回收桶", IP, "成功", null, null,
            string.Format("清空回收桶，共 {0} 個檔案", dt.Rows.Count));
        查詢();
    }

    protected string 取得到期顯示(object 刪除時間, object 剩餘天數)
    {
        if (刪除時間 == DBNull.Value || 刪除時間 == null) return "-";
        string 到期 = 民國日期.轉換日期(Convert.ToDateTime(刪除時間).AddDays(60));
        if (剩餘天數 != DBNull.Value && 剩餘天數 != null && Convert.ToInt32(剩餘天數) <= 7)
            return string.Format("{0} <span style='color:#dc2626;font-size:10px;font-weight:600;'>({1}天後刪除)</span>",
                到期, 剩餘天數);
        return 到期;
    }

    protected string 格式化大小(object 大小)
    {
        if (大小 == DBNull.Value || 大小 == null) return "-";
        long bytes = Convert.ToInt64(大小);
        if (bytes < 1024) return string.Format("{0} B", bytes);
        if (bytes < 1024 * 1024) return string.Format("{0:F1} KB", bytes / 1024.0);
        return string.Format("{0:F1} MB", bytes / (1024.0 * 1024));
    }
}
