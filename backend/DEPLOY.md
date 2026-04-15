# TaoyuanDMS 部署指南（傻瓜版）

> 照著做就對了，一步一步來 👇

---

## 📋 你需要先準備什麼？

請先確認伺服器上有安裝以下軟體：

| # | 軟體 | 去哪裡下載 | 備註 |
|---|------|-----------|------|
| 1 | Windows Server 2016+ | 伺服器本身 | 要先開啟 IIS 功能 |
| 2 | SQL Server 2016+ | 伺服器本身 | 含 SSMS 管理工具 |
| 3 | .NET 8 Hosting Bundle | [點我下載](https://dotnet.microsoft.com/download/dotnet/8.0) | ⚠️ 選 **Hosting Bundle**，不是 SDK |
| 4 | IIS URL Rewrite 模組 | [點我下載](https://www.iis.net/downloads/microsoft/url-rewrite) | 不裝的話頁面重新整理會 404 |
| 5 | Node.js 18+ | [點我下載](https://nodejs.org/) | 打包前端用，選 LTS 版本 |

> ⚠️ 安裝完 .NET 8 Hosting Bundle 後，**一定要**開 CMD 執行：
> ```
> iisreset
> ```

---

## 🔨 步驟一：建立資料庫

1. 開啟 **SQL Server Management Studio (SSMS)**
2. 連線到你的 SQL Server
3. 點選工具列的「**新增查詢**」
4. 用記事本打開 `backend/SQL/001_CreateDatabase.sql`
5. **全選** → **複製** → **貼上**到 SSMS 的查詢視窗
6. 按下工具列的「**執行**」按鈕（或按 F5）
7. 下方訊息區看到 `TaoyuanDMS 資料庫建表完成！` 就代表成功了 ✅

> 💡 SQL 腳本會自動建立 admin 帳號，預設密碼是 `Admin@123`。
> 不需要額外執行任何 SQL，建表完就可以用了！

### 確認資料庫帳號權限

如果你不是用 Windows 驗證（Trusted_Connection），而是用 SQL 帳號連線（例如 `sa_tpc`），請確認該帳號有以下權限：

1. 在 SSMS 展開「**安全性**」→「**登入**」→ 對你的帳號右鍵 →「**屬性**」
2. 左邊選「**使用者對應**」
3. 勾選 `TaoyuanDMS` 資料庫
4. 下方勾選 `db_datareader` 和 `db_datawriter`
5. 按「確定」

---

## 🔨 步驟二：設定並發佈後端

### 2-1. 修改連線設定

用記事本打開 `backend/TaoyuanDMS.API/appsettings.json`，改成你自己的設定：

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=你的SQL伺服器;Database=TaoyuanDMS;User Id=你的帳號;Password=你的密碼;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "換成你自己的密鑰（至少32個字元，例如：MyCompany_DMS_Secret_Key_2024!@#$）",
    "Issuer": "TaoyuanDMS",
    "Audience": "TaoyuanDMS"
  },
  "Storage": {
    "BasePath": "E:\\DMS"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

> ⚠️ **常見錯誤**：
> - 如果用 Windows 驗證，連線字串改成：`Server=.;Database=TaoyuanDMS;Trusted_Connection=True;TrustServerCertificate=True;`
> - `Jwt:Key` 一定要改！用預設的不安全
> - `Storage:BasePath` 是檔案上傳存放的路徑，可以改成你想要的位置

### 2-2. 發佈後端

在 `backend/TaoyuanDMS.API/` 資料夾內開 CMD（在檔案總管的路徑列輸入 `cmd` 按 Enter），執行：

```bash
dotnet publish -c Release -o ./publish
```

> 看到「建置 成功」就代表 OK ✅

### 2-3. 複製到伺服器

把 `publish` 資料夾裡的**所有內容**複製到伺服器上的部署目錄，例如：

```
D:\inetpub\TaoyuanDMS\
├── TaoyuanDMS.API.dll     ← 主程式
├── appsettings.json       ← 設定檔
├── web.config             ← IIS 設定
├── wwwroot\               ← 等一下放前端檔案
└── ...其他 dll 檔案
```

---

## 🔨 步驟三：打包並部署前端

### 3-1. 確認設定檔

打開專案根目錄的 `.env.production`，確認內容是：

```
VITE_API_BASE_URL=/api
```

> 這個通常不用改，預設就是對的

### 3-2. 打包前端

在**專案根目錄**（不是 backend 裡面！）開 CMD，依序執行：

```bash
npm install
npm run build
```

> 執行完會產生一個 `dist` 資料夾

### 3-3. 複製到後端的 wwwroot

把 `dist` 資料夾**裡面的檔案**複製到伺服器部署目錄的 `wwwroot` 資料夾：

```
D:\inetpub\TaoyuanDMS\wwwroot\
├── index.html        ← ✅ 這個一定要在 wwwroot 根目錄
├── assets\
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── ...
```

> ⚠️ **最常犯的錯誤**：
> - ❌ 錯：`wwwroot\dist\index.html`（多包了一層 dist）
> - ✅ 對：`wwwroot\index.html`（直接在 wwwroot 下面）

---

## 🔨 步驟四：建立檔案儲存資料夾

在伺服器上建立檔案上傳的存放目錄（就是 appsettings.json 裡 `Storage:BasePath` 設定的路徑）：

```
E:\DMS\
```

> 如果你改了 BasePath，就建對應的資料夾

---

## 🔨 步驟五：設定 IIS

### 5-1. 建立應用程式集區

1. 打開「**IIS 管理員**」（開始選單搜尋 "IIS"）
2. 左邊點「**應用程式集區**」
3. 右邊點「**新增應用程式集區**」
4. 設定如下：
   - 名稱：`TaoyuanDMS`
   - .NET CLR 版本：**沒有受控碼**（⚠️ 一定要選這個！）
   - 管線模式：**整合式**
5. 按「確定」

### 5-2. 建立網站

1. 左邊點「**站台**」
2. 右邊點「**新增網站**」
3. 設定如下：
   - 網站名稱：`TaoyuanDMS`
   - 應用程式集區：`TaoyuanDMS`（選剛才建的）
   - 實體路徑：`D:\inetpub\TaoyuanDMS`（放 publish 內容的那個資料夾）
   - 連接埠：`80`（或你想要的 Port）
4. 按「確定」

> ⚠️ 如果 Port 80 被 Default Web Site 佔用，先在 Default Web Site 上右鍵 →「停止」

### 5-3. 設定資料夾權限

需要給 **兩個資料夾** 設定權限：

| 資料夾 | 給誰 | 權限 |
|--------|------|------|
| `D:\inetpub\TaoyuanDMS` | `IIS_IUSRS` | 讀取和執行 |
| `E:\DMS` | `IIS_IUSRS` | **完全控制**（讀+寫+建資料夾） |

**設定方式**（每個資料夾都要做）：
1. 對資料夾右鍵 →「**內容**」
2. 切到「**安全性**」分頁
3. 按「**編輯**」
4. 按「**新增**」
5. 輸入 `IIS_IUSRS`，按「**檢查名稱**」確認找到
6. 按「確定」
7. 勾選對應的權限
8. 按「確定」→「確定」

---

## 🔨 步驟六：測試

1. 開瀏覽器，輸入 `http://localhost`（或你設定的 Port，例如 `http://localhost:8080`）
2. 應該看到歡迎頁面
3. 登入測試：
   - 帳號：`admin`
   - 密碼：`Admin@123`
4. ✅ 看到系統主畫面就代表部署成功！
5. **登入成功後請立即到個人資料頁修改密碼！**

---

## 🔄 日後更新

### 只更新前端（改了畫面、樣式）

1. 在專案根目錄執行 `npm run build`
2. 把新的 `dist` 裡面的檔案覆蓋到伺服器的 `wwwroot` 資料夾
3. 清除瀏覽器快取（Ctrl+Shift+Delete）重新整理

### 只更新後端（改了程式邏輯、API）

1. 在 IIS 管理員 → 對網站右鍵 →「**停止**」
2. 在 `backend/TaoyuanDMS.API/` 重新執行 `dotnet publish -c Release -o ./publish`
3. 把 publish 裡的檔案覆蓋到伺服器部署目錄（**不要覆蓋 wwwroot 資料夾**！）
4. 回 IIS 管理員 →「**啟動**」網站

### 前後端都更新

先做後端更新（停站 → publish → 覆蓋），再做前端更新（build → 覆蓋 wwwroot），最後啟動網站。

---

## ❓ 常見問題排解

| 現象 | 原因 | 解決方式 |
|------|------|----------|
| 網頁顯示 **500 錯誤** | 資料庫連不上 | 檢查 `appsettings.json` 的連線字串是否正確 |
| 網頁顯示 **502.5 錯誤** | .NET 環境沒裝好 | 重新安裝 .NET 8 **Hosting Bundle**，裝完跑 `iisreset` |
| 登入失敗 | 密碼 hash 不正確 | 確認有執行完整的 `001_CreateDatabase.sql` |
| 頁面重新整理變 **404** | 缺少 URL Rewrite | 安裝 [IIS URL Rewrite 模組](https://www.iis.net/downloads/microsoft/url-rewrite) |
| 上傳檔案失敗 | 儲存目錄沒權限 | 確認 `E:\DMS` 已建立，且 `IIS_IUSRS` 有完全控制權限 |
| 畫面空白 | 前端檔案放錯位置 | 確認 `wwwroot\index.html` 存在（不是 `wwwroot\dist\index.html`） |
| 顯示 IIS 預設頁 | 網站沒指對路徑 | 確認 IIS 網站實體路徑指向 publish 內容的資料夾 |

---

## 📊 資料表清單（10 張）

| # | 資料表 | 說明 | 預置資料 |
|---|--------|------|----------|
| 1 | Users | 使用者帳號 | 1 筆（admin，密碼 Admin@123） |
| 2 | UserRegistrations | 帳號申請紀錄 | 無 |
| 3 | Files | 檔案與資料夾 | 無 |
| 4 | TrashItems | 回收桶 | 無 |
| 5 | AuditLogs | 稽核日誌 | 無 |
| 6 | FolderPermissions | 資料夾權限 | 無 |
| 7 | PermanentZoneOverrides | 永久區跨組別權限 | 無 |
| 8 | EditLocks | 編輯鎖定 | 無 |
| 9 | DepartmentQuotas | 組別配額 | 32 筆（16組 × 2區） |
| 10 | DepartmentSections | 課別管理 | 無 |
