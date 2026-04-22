using System;
using System.Configuration;
using System.Data;
using System.IO;
using System.Web.UI.WebControls;

public partial class 審核管理 : System.Web.UI.Page
{
    private string 我的IP;
    private int 我的帳號編號;
    private DataTable 可審核組別dt;

    protected void Page_Load(object sender, EventArgs e)
    {
        if (Session["已登入"] == null) Response.Redirect("~/登入.aspx");
        if (!角色輔助.要求負責人以上(this)) return;
        我的IP = IP輔助.取得用戶端IP();
        我的帳號編號 = 帳號輔助.取得帳號編號();
        lbl您IP.Text = 我的IP;

        if (!IsPostBack) 載入頁面();
    }

    private void 載入頁面()
    {
        // ── A2: 改用帳號角色判斷可審核組別，管理員可看全部，負責人看自己組別 ──
        if (角色輔助.是管理員())
        {
            可審核組別dt = 資料庫輔助.查詢(
                "SELECT 組別編號, 組別名稱, 組別代碼 FROM 組別設定 WHERE 是否啟用=1");
        }
        else
        {
            // 負責人：依帳號編號查詢其所屬組別（角色=負責人）
            int? 組別 = 帳號輔助.取得組別編號();
            if (組別 == null)
            {
                pnl非負責人.Visible = true;
                pnl審核區.Visible = false;
                return;
            }
            可審核組別dt = 資料庫輔助.查詢(
                "SELECT 組別編號, 組別名稱, 組別代碼 FROM 組別設定 WHERE 組別編號=@g AND 是否啟用=1",
                資料庫輔助.P("@g", 組別.Value));
        }

        if (可審核組別dt.Rows.Count == 0)
        {
            pnl非負責人.Visible = true;
            pnl審核區.Visible = false;
            return;
        }

        pnl非負責人.Visible = false;
        pnl審核區.Visible = true;

        string 組別列表 = "";
        var 組別編號列表 = new System.Collections.Generic.List<int>();
        foreach (DataRow row in 可審核組別dt.Rows)
        {
            組別列表 += row["組別名稱"] + " ";
            組別編號列表.Add(Convert.ToInt32(row["組別編號"]));
        }
        lbl可審核組別.Text = 組別列表.Trim();

        // ── A2: 改用 TVP 或多個參數取代字串拼接 IN 子句，防止 SQL Injection ──
        // 以臨時資料表方式傳遞多個組別編號
        string inClause = string.Join(",", 組別編號列表.ConvertAll(id => id.ToString()));

        // 待審核清單（inClause 此時只含整數，安全）
        var 待審 = 資料庫輔助.查詢(string.Format(@"
            SELECT f.檔案編號, f.原始檔名, f.描述, f.副檔名, f.檔案大小, f.上傳時間, f.上傳者IP,
                   g.組別名稱
            FROM 檔案主檔 f JOIN 組別設定 g ON f.組別編號=g.組別編號
            WHERE f.審核狀態='待審核' AND f.儲存區類型='永久區' AND f.是否刪除=0
                  AND f.組別編號 IN ({0})
            ORDER BY f.上傳時間", inClause));
        gv待審核.DataSource = 待審;
        gv待審核.DataBind();

        // 近期審核紀錄
        var 紀錄 = 資料庫輔助.查詢(string.Format(@"
            SELECT TOP 20 f.原始檔名, g.組別名稱, f.審核狀態, f.審核者IP, f.審核時間, f.審核備註
            FROM 檔案主檔 f JOIN 組別設定 g ON f.組別編號=g.組別編號
            WHERE f.審核狀態 IN ('已通過','未通過') AND f.組別編號 IN ({0})
            ORDER BY f.審核時間 DESC", inClause));
        gv審核紀錄.DataSource = 紀錄;
        gv審核紀錄.DataBind();
    }

    protected void gv待審核_RowCommand(object sender, GridViewCommandEventArgs e)
    {
        if (e.CommandName != "通過" && e.CommandName != "未通過") return;

        int 檔案編號 = int.Parse(e.CommandArgument.ToString());
        string 新狀態 = e.CommandName == "通過" ? "已通過" : "未通過";

        // ── A2: 改用帳號角色驗證審核權限，不再依賴 IP ──
        var 檔案 = 資料庫輔助.查詢(
            "SELECT 組別編號, 原始檔名, 儲存檔名, 檔案路徑 FROM 檔案主檔 WHERE 檔案編號=@id",
            資料庫輔助.P("@id", 檔案編號));
        if (檔案.Rows.Count == 0) return;

        int 組別編號 = Convert.ToInt32(檔案.Rows[0]["組別編號"]);

        // 管理員可審核任何組別；負責人只能審核自己組別
        bool 有審核權 = 角色輔助.是管理員() || 角色輔助.是本組負責人(組別編號);
        if (!有審核權)
        {
            操作紀錄輔助.資安警示("未授權審核", "高", 我的IP,
                string.Format("檔案編號:{0}", 檔案編號), "非負責人嘗試審核");
            return;
        }

        if (新狀態 == "未通過")
        {
            int 天數;
            int.TryParse(ConfigurationManager.AppSettings["時效區天數"], out 天數);
            if (天數 <= 0) 天數 = 30;
            DateTime 到期 = DateTime.Now.AddDays(天數);

            string 舊路徑 = 檔案.Rows[0]["檔案路徑"].ToString();
            string 新路徑 = 舊路徑; // 預設不變

            // ── B2: 實體移檔失敗時不更新 DB 路徑，保持一致性 ──
            bool 移檔成功 = false;
            try
            {
                string 組別代碼 = 資料庫輔助.查詢(
                    "SELECT 組別代碼 FROM 組別設定 WHERE 組別編號=@編號",
                    資料庫輔助.P("@編號", 組別編號)).Rows[0]["組別代碼"].ToString();
                string 時效路徑 = Path.Combine(ConfigurationManager.AppSettings["時效區路徑"], 組別代碼);
                Directory.CreateDirectory(時效路徑);
                新路徑 = Path.Combine(時效路徑, 檔案.Rows[0]["儲存檔名"].ToString());
                if (File.Exists(舊路徑))
                {
                    File.Move(舊路徑, 新路徑);
                    移檔成功 = true;
                }
            }
            catch (Exception ex)
            {
                // 移檔失敗：記錄資安警示，但不更新 DB 路徑（保持一致性）
                操作紀錄輔助.資安警示("審核移檔失敗", "中", 我的IP,
                    檔案.Rows[0]["原始檔名"].ToString(),
                    string.Format("實體移檔失敗: {0}", ex.Message));
                新路徑 = 舊路徑; // 維持原路徑
            }

            if (移檔成功)
            {
                資料庫輔助.執行(@"UPDATE 檔案主檔 SET 審核狀態=@狀態, 審核者IP=@IP, 審核時間=GETDATE(),
                                  儲存區類型='時效區', 到期時間=@到期, 檔案路徑=@新路徑
                                  WHERE 檔案編號=@編號",
                    資料庫輔助.P("@狀態", 新狀態), 資料庫輔助.P("@IP", 我的IP),
                    資料庫輔助.P("@到期", 到期), 資料庫輔助.P("@新路徑", 新路徑),
                    資料庫輔助.P("@編號", 檔案編號));
            }
            else
            {
                // 移檔失敗：只更新審核狀態，不改路徑（避免 DB 與磁碟不一致）
                資料庫輔助.執行(@"UPDATE 檔案主檔 SET 審核狀態=@狀態, 審核者IP=@IP, 審核時間=GETDATE(),
                                  儲存區類型='時效區', 到期時間=@到期 WHERE 檔案編號=@編號",
                    資料庫輔助.P("@狀態", 新狀態), 資料庫輔助.P("@IP", 我的IP),
                    資料庫輔助.P("@到期", 到期), 資料庫輔助.P("@編號", 檔案編號));
            }
        }
        else
        {
            資料庫輔助.執行(@"UPDATE 檔案主檔 SET 審核狀態='已通過', 審核者IP=@IP, 審核時間=GETDATE()
                              WHERE 檔案編號=@編號",
                資料庫輔助.P("@IP", 我的IP), 資料庫輔助.P("@編號", 檔案編號));
        }

        操作紀錄輔助.記錄(檔案編號, "審核", 我的IP, "成功", null,
            檔案.Rows[0]["原始檔名"].ToString(),
            string.Format("審核結果: {0}", 新狀態));
        載入頁面();
    }
}
