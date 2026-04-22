using System;
using System.IO;
using System.Configuration;

public partial class 檔案上傳 : System.Web.UI.Page
{
    protected void Page_Load(object sender, EventArgs e)
    {
        if (Session["已登入"] == null) Response.Redirect("~/登入.aspx");

        string IP = IP輔助.取得用戶端IP();
        lbl您的IP.Text = IP;
        lbl角色.Text = 角色輔助.取得角色();

        bool 可執行檔 = IP輔助.可上傳執行檔(IP);
        lbl執行檔權限.Text = 可執行檔
            ? "<span style='color:#2e7d52;'><i class='fas fa-check'></i> 允許</span>"
            : "<span style='color:#dc2626;'><i class='fas fa-times'></i> 不允許</span>";

        if (!IsPostBack)
        {
            載入資料夾樹();

            // 從瀏覽頁帶入預選資料夾
            string fid = Request.QueryString["fid"];
            litPreFid.Text = !string.IsNullOrEmpty(fid) ? fid : "";

            if (!string.IsNullOrEmpty(fid))
            {
                hf目標資料夾.Value = fid;
                var info = 資料夾輔助.取得資料夾資訊(int.Parse(fid));
                if (info != null)
                    hf目標儲存區.Value = info["儲存區類型"].ToString();
            }
        }
    }

    private void 載入資料夾樹()
    {
        var dt = 資料庫輔助.查詢(@"
            WITH 樹CTE AS (
                SELECT 資料夾編號, 資料夾名稱, 父資料夾編號, 組別編號, 儲存區類型, 0 AS 層級
                FROM 資料夾 WHERE 父資料夾編號 IS NULL AND 是否刪除=0
                UNION ALL
                SELECT f.資料夾編號, f.資料夾名稱, f.父資料夾編號, f.組別編號, f.儲存區類型, t.層級+1
                FROM 資料夾 f INNER JOIN 樹CTE t ON f.父資料夾編號=t.資料夾編號
                WHERE f.是否刪除=0
            )
            SELECT t.資料夾編號, t.資料夾名稱, t.層級, t.儲存區類型,
                   (SELECT COUNT(*) FROM 資料夾 c WHERE c.父資料夾編號=t.資料夾編號 AND c.是否刪除=0) AS 子資料夾數,
                   (SELECT COUNT(*) FROM 檔案主檔 m WHERE m.資料夾編號=t.資料夾編號 AND m.是否刪除=0) AS 檔案數
            FROM 樹CTE t
            ORDER BY t.儲存區類型, t.層級, t.資料夾名稱
            OPTION (MAXRECURSION 20)");

        rpt資料夾選擇.DataSource = dt;
        rpt資料夾選擇.DataBind();
    }

    protected void btn上傳_Click(object sender, EventArgs e)
    {
        string IP = IP輔助.取得用戶端IP();

        if (!fu檔案.HasFile) { 顯示錯誤("請選擇要上傳的檔案"); return; }

        // ── A1: 統一呼叫 檔案安全輔助 進行完整驗證（含雙重副檔名、MIME 比對）──
        string 安全錯誤;
        if (!檔案安全輔助.驗證上傳檔案(fu檔案.PostedFile, IP, out 安全錯誤))
        {
            // 若是執行檔相關拒絕，額外寫資安警示
            if (安全錯誤.Contains("執行檔") || 安全錯誤.Contains("雙重副檔名"))
            {
                操作紀錄輔助.記錄(null, "上傳", IP, "拒絕",
                    string.Format("安全驗證失敗: {0} | 檔案: {1}", 安全錯誤, fu檔案.FileName));
                操作紀錄輔助.資安警示("上傳安全驗證失敗", "高", IP,
                    Path.GetFileName(fu檔案.FileName), 安全錯誤);
            }
            顯示錯誤(安全錯誤);
            return;
        }

        // ── 檔案大小檢查 ──
        int 最大MB;
        int.TryParse(ConfigurationManager.AppSettings["最大上傳MB"], out 最大MB);
        if (最大MB <= 0) 最大MB = 500;
        if (fu檔案.PostedFile.ContentLength > 最大MB * 1024 * 1024)
        {
            顯示錯誤(string.Format("檔案大小超過 {0}MB 限制", 最大MB));
            return;
        }

        string fidStr = hf目標資料夾.Value;
        if (string.IsNullOrEmpty(fidStr)) { 顯示錯誤("請選擇目標資料夾"); return; }

        int 目標資料夾編號 = int.Parse(fidStr);
        var 資料夾info = 資料夾輔助.取得資料夾資訊(目標資料夾編號);
        if (資料夾info == null) { 顯示錯誤("所選資料夾不存在"); return; }

        // ── 寫入權限驗證 ──
        if (!權限輔助.可存取資料夾(資料夾info, true))
        {
            操作紀錄輔助.記錄(null, "上傳", IP, "拒絕", "無寫入權限", Path.GetFileName(fu檔案.FileName));
            顯示錯誤("您沒有上傳至此資料夾的權限");
            return;
        }

        int 組別編號 = Convert.ToInt32(資料夾info["組別編號"]);
        string 儲存區類型 = 資料夾info["儲存區類型"].ToString();

        string 原始檔名 = Path.GetFileName(fu檔案.FileName);
        string 副檔名 = Path.GetExtension(原始檔名).ToLower();

        string 個資風險 = 個資偵測.掃描檔名(原始檔名);

        try
        {
            string 實體路徑 = 資料夾info["實體路徑"].ToString();
            Directory.CreateDirectory(實體路徑);

            string 唯一檔名 = string.Format("{0:yyyyMMddHHmmss}_{1:N}{2}", DateTime.Now, Guid.NewGuid(), 副檔名);
            string 完整路徑 = Path.Combine(實體路徑, 唯一檔名);
            fu檔案.SaveAs(完整路徑);

            // ── C1: 從設定讀取時效區天數，不寫死 ──
            int 時效天數;
            int.TryParse(ConfigurationManager.AppSettings["時效區天數"], out 時效天數);
            if (時效天數 <= 0) 時效天數 = 30;

            DateTime? 到期時間 = null;
            if (儲存區類型 == "時效區")
                到期時間 = DateTime.Now.AddDays(時效天數);

            string 審核狀態 = 儲存區類型 == "永久區" ? "待審核" : "不需審核";

            object result = 資料庫輔助.查詢單值(@"
                INSERT INTO 檔案主檔
                    (組別編號, 資料夾編號, 儲存區類型, 原始檔名, 儲存檔名, 檔案路徑,
                     檔案大小, 檔案類型, 副檔名, 上傳者IP, 到期時間, 審核狀態, 描述)
                VALUES
                    (@組別, @資料夾, @儲存區, @原始, @儲存, @路徑,
                     @大小, @類型, @副檔名, @IP, @到期, @狀態, @描述);
                SELECT SCOPE_IDENTITY();",
                資料庫輔助.P("@組別",  組別編號),
                資料庫輔助.P("@資料夾", 目標資料夾編號),
                資料庫輔助.P("@儲存區", 儲存區類型),
                資料庫輔助.P("@原始",  原始檔名),
                資料庫輔助.P("@儲存",  唯一檔名),
                資料庫輔助.P("@路徑",  完整路徑),
                資料庫輔助.P("@大小",  fu檔案.PostedFile.ContentLength),
                資料庫輔助.P("@類型",  fu檔案.PostedFile.ContentType),
                資料庫輔助.P("@副檔名", 副檔名),
                資料庫輔助.P("@IP",    IP),
                資料庫輔助.P("@到期",  (object)到期時間 ?? DBNull.Value),
                資料庫輔助.P("@狀態",  審核狀態),
                資料庫輔助.P("@描述",  txt描述.Text.Trim()));

            int 新id = Convert.ToInt32(result);

            if (!string.IsNullOrEmpty(個資風險))
                資料庫輔助.執行(@"INSERT INTO 個資稽核紀錄 (檔案編號,偵測類型,偵測內容,操作者IP,操作類型,風險等級)
                    VALUES (@編號,@類型,@內容,@IP,@操作,@等級)",
                    資料庫輔助.P("@編號", 新id),
                    資料庫輔助.P("@類型", "檔名個資偵測"),
                    資料庫輔助.P("@內容", string.Format("{0}: {1}", 原始檔名, 個資風險)),
                    資料庫輔助.P("@IP",   IP),
                    資料庫輔助.P("@操作", "上傳"),
                    資料庫輔助.P("@等級", "中"));

            操作紀錄輔助.記錄(新id, "上傳", IP, "成功", null, 原始檔名,
                string.Format("{0} / {1}", 儲存區類型, 資料夾info["資料夾名稱"]));

            // ── C1: 成功訊息使用動態天數 ──
            string 訊息 = 儲存區類型 == "永久區"
                ? string.Format("「{0}」已上傳至永久區，待組別負責人審核。", 原始檔名)
                : string.Format("「{0}」已上傳至時效區，{1}天後自動移入回收桶。", 原始檔名, 時效天數);

            pnl訊息.Visible = true;
            pnl錯誤.Visible = false;
            lbl成功訊息.Text = 訊息;
        }
        catch (Exception ex)
        {
            操作紀錄輔助.記錄(null, "上傳", IP, "失敗", ex.Message, 原始檔名);
            顯示錯誤(string.Format("上傳失敗: {0}", ex.Message));
        }
    }

    private void 顯示錯誤(string msg) { pnl錯誤.Visible = true; pnl訊息.Visible = false; lbl錯誤訊息.Text = msg; }
}
