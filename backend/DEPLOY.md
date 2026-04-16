# TaoyuanDMS 雙站台部署指南

> **架構說明**：前端（React）和後端（.NET 8 API）分別部署在兩個 IIS 站台上。
>
> | 站台 | 用途 | Port | 範例 URL |
> |------|------|------|----------|
> | TaoyuanDMS-Frontend | 前端靜態網頁 | HTTPS 7443 | `https://MYSERVER:7443` |
> | TaoyuanDMS-API | 後端 API 服務 | HTTPS 8443 | `https://MYSERVER:8443/api` |
>
> 💡 本指南所有範例使用以下假設值，請替換成你自己的：
> - SQL Server 帳號：`sa_tpc`，密碼：`MyP@ssw0rd`
> - 伺服器名稱：`MYSERVER\SQLEXPRESS`（或 IP 如 `192.168.1.100`）
> - 前端部署目錄：`D:\inetpub\TaoyuanDMS-Frontend`
> - 後端部署目錄：`D:\inetpub\TaoyuanDMS-API`
> - 檔案儲存目錄：`E:\DMS`

---

## 📋 你需要先準備什麼？

| # | 軟體 | 去哪裡下載 | 備註 |
|---|------|-----------|------|
| 1 | Windows Server 2016+ | 伺服器本身 | 要先開啟 IIS 功能 |
| 2 | SQL Server 2016+ | 伺服器本身 | 含 SSMS 管理工具 |
| 3 | .NET 8 Hosting Bundle | [點我下載](https://dotnet.microsoft.com/download/dotnet/8.0) | ⚠️ 選 **Hosting Bundle**，不是 SDK |
| 4 | IIS URL Rewrite 模組 | [點我下載](https://www.iis.net/downloads/microsoft/url-rewrite) | 前端 SPA 必裝，不裝重新整理會 404 |
| 5 | Node.js 18+ | [點我下載](https://nodejs.org/) | 打包前端用，選 LTS 版本 |

### 開啟 IIS 功能

1. 開啟「**伺服器管理員**」（Server Manager）
2. 點「**管理**」→「**新增角色及功能**」
3. 一路按「下一步」直到「**伺服器角色**」頁面
4. 勾選「**Web 伺服器 (IIS)**」→ 彈出視窗按「新增功能」
5. 繼續按「下一步」直到完成安裝

> ⚠️ 安裝完 .NET 8 Hosting Bundle 後，**一定要**開 CMD 執行：
> ```
> iisreset
> ```

---

## 🔨 步驟一：建立資料庫

1. 開啟 **SSMS**，連線到 SQL Server
2. 點工具列的「**新增查詢**」（Ctrl+N）
3. 打開 `backend/SQL/001_CreateDatabase.sql`，全選複製貼上到查詢視窗
4. 按「**執行**」（F5）
5. 看到 `TaoyuanDMS 資料庫建表完成！` 就成功了 ✅

> 💡 SQL 腳本會自動建立 admin 帳號，預設密碼是 `Admin@123`

### 確認資料庫帳號權限（SQL 驗證時）

1. SSMS 左側展開「**安全性**」→「**登入**」
2. 對你的帳號右鍵 →「**屬性**」→ 左邊選「**使用者對應**」
3. 上方勾選 `TaoyuanDMS`，下方勾選 ✅ `db_datareader` 和 ✅ `db_datawriter`
4. 按「確定」

---

## 🔨 步驟二：設定並發佈後端

### 2-1. 修改 appsettings.json

用記事本打開 `backend/TaoyuanDMS.API/appsettings.json`：

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=MYSERVER\\SQLEXPRESS;Database=TaoyuanDMS;User Id=sa_tpc;Password=MyP@ssw0rd;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "替換成你自己的密鑰_至少32字元_越長越安全!@#$%",
    "Issuer": "TaoyuanDMS",
    "Audience": "TaoyuanDMS"
  },
  "Storage": {
    "BasePath": "E:\\DMS"
  },
  "Cors": {
    "AllowedOrigins": "https://MYSERVER:7443"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information"
    }
  }
}
```

> ⚠️ **關鍵設定**：
> - `Cors:AllowedOrigins` = 你前端站台的完整 URL（含 https 和 port）
> - 如果前端用 IP 存取，就填 `https://192.168.1.100:7443`
> - 如果有多個來源，用逗號分隔：`https://MYSERVER:7443,https://192.168.1.100:7443`

### 2-2. 發佈後端

在 `backend\TaoyuanDMS.API\` 資料夾開 CMD：

```bash
dotnet publish -c Release -o ./publish
```

### 2-3. 複製到伺服器

1. 建立資料夾：`D:\inetpub\TaoyuanDMS-API`
2. 把 `publish` 裡面**所有內容**複製到 `D:\inetpub\TaoyuanDMS-API\`

完成後目錄結構：

```
D:\inetpub\TaoyuanDMS-API\
├── TaoyuanDMS.API.dll        ← 主程式
├── TaoyuanDMS.API.exe
├── appsettings.json           ← 你改過的設定檔
├── web.config                 ← 後端用（只有 AspNetCore 設定）
└── ...其他 .dll 檔案
```

> ⚠️ **注意**：後端目錄**不需要** wwwroot 資料夾，API 不提供靜態檔案。

---

## 🔨 步驟三：打包並部署前端

### 3-1. 修改 .env.production

打開專案根目錄的 `.env.production`，改成你的後端位址：

```
VITE_API_BASE_URL=https://MYSERVER:8443/api
```

> 💡 範例：
> - 用伺服器名稱：`VITE_API_BASE_URL=https://MYSERVER:8443/api`
> - 用 IP 位址：`VITE_API_BASE_URL=https://192.168.1.100:8443/api`
> - ⚠️ 這裡填什麼，使用者的瀏覽器就會連到哪裡，所以要填**使用者能連到的位址**

### 3-2. 打包前端

在專案根目錄（有 `package.json` 的資料夾）開 CMD：

```bash
npm install
npm run build
```

### 3-3. 複製到伺服器

1. 建立資料夾：`D:\inetpub\TaoyuanDMS-Frontend`
2. 打開打包產生的 `dist` 資料夾
3. 把 `dist` **裡面的所有檔案**複製到 `D:\inetpub\TaoyuanDMS-Frontend\`

完成後目錄結構：

```
D:\inetpub\TaoyuanDMS-Frontend\
├── index.html                 ← ✅ 一定要在根目錄
├── web.config                 ← 前端用（SPA 路由 + 靜態檔案設定）
├── robots.txt
└── assets\
    ├── index-Ab1Cd2Ef.js
    └── index-Gh3Ij4Kl.css
```

> ⚠️ **最常犯的錯誤**：
> - ❌ 錯：`TaoyuanDMS-Frontend\dist\index.html`（多包一層 dist）
> - ✅ 對：`TaoyuanDMS-Frontend\index.html`

---

## 🔨 步驟四：建立檔案儲存資料夾

在伺服器上建立 `E:\DMS\` 資料夾（對應 `appsettings.json` 裡的 `Storage:BasePath`）。

---

## 🔨 步驟五：建立 SSL 自簽憑證

> 💡 如果你已經有正式的 SSL 憑證（.pfx 檔），可以跳過這步，直接在步驟六匯入。

### 用 PowerShell 產生自簽憑證

以**系統管理員**身分開啟 PowerShell，執行：

```powershell
# 產生憑證（有效期 5 年，請把 MYSERVER 改成你的伺服器名稱或 IP）
New-SelfSignedCertificate `
    -DnsName "MYSERVER", "localhost", "192.168.1.100" `
    -CertStoreLocation "cert:\LocalMachine\My" `
    -NotAfter (Get-Date).AddYears(5) `
    -FriendlyName "TaoyuanDMS SSL"
```

執行後會顯示憑證指紋（Thumbprint），例如：

```
Thumbprint                                Subject
----------                                -------
A1B2C3D4E5F6...                          CN=MYSERVER
```

> 💡 **記下這個 Thumbprint**，等一下設定 IIS 會用到。

### 將憑證加入信任

如果用自簽憑證，瀏覽器會顯示「不安全」警告。要消除警告：

1. 按 `Win+R`，輸入 `mmc`，按 Enter
2. 「檔案」→「新增/移除嵌入式管理單元」
3. 選「**憑證**」→「新增」→ 選「**電腦帳戶**」→「下一步」→「完成」→「確定」
4. 左側展開「**憑證**」→「**個人**」→「**憑證**」
5. 找到剛才建的 `TaoyuanDMS SSL` 憑證，**右鍵** →「**複製**」
6. 左側展開「**受信任的根憑證授權單位**」→「**憑證**」→ **右鍵** →「**貼上**」

> ⚠️ 使用者的電腦也需要信任這張憑證，否則瀏覽器會顯示警告。
> 可以把憑證匯出（.cer 檔）發給使用者安裝，或用 GPO 派送。

---

## 🔨 步驟六：設定 IIS（兩個站台）

### 6-1. 建立兩個應用程式集區

開啟 IIS 管理員，左側點「**應用程式集區**」：

| 名稱 | .NET CLR 版本 | 管線模式 |
|------|--------------|---------|
| `TaoyuanDMS-API` | **沒有受控碼** | 整合式 |
| `TaoyuanDMS-Frontend` | **沒有受控碼** | 整合式 |

> 操作：右側「動作」→「新增應用程式集區」→ 填上表資料 → 確定

### 6-2. 建立後端站台（Port 8443）

1. 左側點「**站台**」→ 右側「**新增網站**」
2. 填寫：

```
網站名稱：       TaoyuanDMS-API
應用程式集區：   TaoyuanDMS-API
實體路徑：       D:\inetpub\TaoyuanDMS-API

繫結設定：
  類型：         https
  IP 位址：      全部未指派
  連接埠：       8443
  SSL 憑證：     TaoyuanDMS SSL（選剛才建的那張）
```

3. 按「確定」

### 6-3. 建立前端站台（Port 7443）

1. 左側點「**站台**」→ 右側「**新增網站**」
2. 填寫：

```
網站名稱：       TaoyuanDMS-Frontend
應用程式集區：   TaoyuanDMS-Frontend
實體路徑：       D:\inetpub\TaoyuanDMS-Frontend

繫結設定：
  類型：         https
  IP 位址：      全部未指派
  連接埠：       7443
  SSL 憑證：     TaoyuanDMS SSL（同一張憑證）
```

3. 按「確定」

### 6-4. 設定資料夾權限

| 資料夾 | 給誰 | 權限 | 原因 |
|--------|------|------|------|
| `D:\inetpub\TaoyuanDMS-API` | `IIS_IUSRS` | 讀取和執行 | IIS 讀取後端程式 |
| `D:\inetpub\TaoyuanDMS-Frontend` | `IIS_IUSRS` | 讀取和執行 | IIS 讀取前端檔案 |
| `E:\DMS` | `IIS_IUSRS` | **完全控制** | 系統讀寫上傳檔案 |

**設定方式**（每個資料夾都做一次）：

1. 資料夾 **右鍵** →「**內容**」→「**安全性**」分頁
2. 「**編輯**」→「**新增**」→ 輸入 `IIS_IUSRS` →「**檢查名稱**」→「確定」
3. 勾選對應權限 → 「確定」

---

## 🔨 步驟七：測試

### 7-1. 測試後端 API

開瀏覽器，輸入：

```
https://MYSERVER:8443/api/auth/login
```

應該看到類似 `405 Method Not Allowed` 或 JSON 錯誤訊息（因為是 GET 請求），**這代表後端正常運作** ✅。

如果看到 IIS 預設頁或 502/503 錯誤，請檢查：
- 應用程式集區有沒有選「沒有受控碼」
- 實體路徑對不對
- .NET 8 Hosting Bundle 有沒有裝 + 執行過 `iisreset`

### 7-2. 測試前端

開瀏覽器，輸入：

```
https://MYSERVER:7443
```

應該看到系統歡迎頁面（Landing Page）✅

### 7-3. 登入測試

1. 點「**登入**」
2. 帳號：`admin`，密碼：`Admin@123`
3. 按「登入」
4. 看到系統主畫面 = 部署成功！ 🎉

### 7-4. 功能測試清單

| # | 測試項目 | 怎麼測 | 預期結果 |
|---|---------|--------|---------|
| 1 | 登入 | admin / Admin@123 | 進入主畫面 |
| 2 | 建立資料夾 | 新增一個資料夾 | 出現在列表中 |
| 3 | 上傳檔案 | 上傳一個 .txt | 出現在列表中 |
| 4 | 下載檔案 | 點擊下載 | 正常下載 |
| 5 | 重新整理 | 按 F5 | 頁面正常（不會 404） |

> 🔒 登入成功後，**請立即修改 admin 密碼！**

---

## 🔄 日後更新

### 只更新前端

```bash
# 1. 修改 .env.production 確認 API 位址正確
# 2. 重新打包
npm run build

# 3. 把 dist 裡面的檔案覆蓋到前端站台目錄
#    D:\inetpub\TaoyuanDMS-Frontend\

# 4. 不需要停站！靜態檔案直接覆蓋即可
# 5. 使用者清除瀏覽器快取（Ctrl+Shift+Delete）
```

### 只更新後端

```bash
# 1. 先停止後端站台
#    IIS 管理員 → TaoyuanDMS-API → 右鍵「停止」

# 2. 重新發佈
cd backend\TaoyuanDMS.API
dotnet publish -c Release -o ./publish

# 3. 把 publish 裡的檔案覆蓋到後端站台目錄
#    覆蓋 D:\inetpub\TaoyuanDMS-API\ 裡的 .dll/.exe 檔案
#    ⚠️ 不要覆蓋 appsettings.json（除非設定有改）

# 4. 回 IIS 管理員 →「啟動」後端站台
```

### 前後端都更新

1. **停後端站台**
2. **更新後端**：`dotnet publish` → 覆蓋 .dll/.exe
3. **更新前端**：`npm run build` → 覆蓋前端站台目錄
4. **啟動後端站台**

---

## ❓ 常見問題排解

| 現象 | 原因 | 解決方式 |
|------|------|----------|
| 前端畫面出現但**登入失敗** | CORS 被擋 | 1. 按 F12 看 Console 有無 CORS 錯誤<br>2. 確認 `appsettings.json` 的 `Cors:AllowedOrigins` 填的是前端的完整 URL<br>3. 範例：`https://MYSERVER:7443`（不要加結尾 `/`） |
| **CORS 錯誤**：`has been blocked by CORS policy` | 來源不匹配 | `AllowedOrigins` 必須和瀏覽器網址列**完全一致**（含 https、port）<br>用 IP 開就填 IP，用主機名開就填主機名 |
| 網頁顯示 **500 錯誤** | 資料庫連不上 | 檢查 `appsettings.json` 連線字串 |
| 網頁顯示 **502.5 錯誤** | .NET 環境問題 | 重裝 .NET 8 Hosting Bundle → `iisreset` → 集區選「沒有受控碼」 |
| 頁面重新整理 **404** | 缺 URL Rewrite 或 web.config | 1. 安裝 URL Rewrite 模組<br>2. 確認前端目錄有 `web.config`（打包時會自動從 public 複製） |
| 上傳檔案失敗 | 儲存目錄沒權限 | `E:\DMS` 給 `IIS_IUSRS` **完全控制**權限 |
| 前端空白 | index.html 放錯位置 | 確認 `D:\inetpub\TaoyuanDMS-Frontend\index.html` 存在 |
| **SSL 憑證警告** | 自簽憑證未信任 | 把憑證加入「受信任的根憑證授權單位」（見步驟五） |
| API 回傳 **401** | JWT 設定不對 | 確認 `Jwt:Key` 至少 32 字元 |

---

## 📁 完整目錄結構

```
D:\inetpub\
├── TaoyuanDMS-API\                    ← 後端站台（Port 8443）
│   ├── TaoyuanDMS.API.dll
│   ├── TaoyuanDMS.API.exe
│   ├── appsettings.json               ← 連線 + CORS 設定
│   ├── web.config                     ← 後端 web.config（只有 AspNetCore）
│   └── ...其他 .dll
│
└── TaoyuanDMS-Frontend\               ← 前端站台（Port 7443）
    ├── index.html
    ├── web.config                     ← 前端 web.config（SPA 路由）
    ├── robots.txt
    └── assets\
        ├── index-Ab1Cd2Ef.js
        └── index-Gh3Ij4Kl.css

E:\DMS\                                ← 檔案儲存區
├── permanent\
└── temporary\
```

---

## 📊 資料表清單（10 張）

| # | 資料表 | 說明 | 預置資料 |
|---|--------|------|----------|
| 1 | Users | 使用者帳號 | 1 筆（admin） |
| 2 | UserRegistrations | 帳號申請 | 無 |
| 3 | Files | 檔案與資料夾 | 無 |
| 4 | TrashItems | 回收桶 | 無 |
| 5 | AuditLogs | 稽核日誌 | 無 |
| 6 | FolderPermissions | 資料夾權限 | 無 |
| 7 | PermanentZoneOverrides | 永久區跨組權限 | 無 |
| 8 | EditLocks | 編輯鎖定 | 無 |
| 9 | DepartmentQuotas | 組別配額 | 32 筆 |
| 10 | DepartmentSections | 課別管理 | 無 |
