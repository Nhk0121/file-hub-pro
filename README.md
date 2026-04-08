# 桃園區公所 文件管理系統 (TaoyuanDMS)

## 系統架構（單一站台）

```
┌─────────────────────────────────────────┐
│          Windows Server (IIS)           │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │  單一 IIS 站台 (Port 80/443)      │  │
│  │                                   │  │
│  │  /api/*  → ASP.NET Core 處理      │  │
│  │  其他    → wwwroot/index.html     │  │
│  │          (React 前端)             │  │
│  └──────────────┬────────────────────┘  │
│                 │                        │
│  ┌──────────────▼────────────────────┐  │
│  │  SQL Server (TaoyuanDMS 資料庫)    │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

前端（React + Vite）打包後的靜態檔案放在後端（ASP.NET Core）的 `wwwroot` 資料夾內，由同一個 IIS 站台提供服務。

---

## 前置需求

| 軟體 | 版本 | 說明 |
|------|------|------|
| Windows Server | 2016 以上 | 已安裝 IIS |
| SQL Server | 2016 以上 | 資料庫 |
| .NET 8 Hosting Bundle | 最新版 | [下載](https://dotnet.microsoft.com/download/dotnet/8.0)（選 Hosting Bundle） |
| IIS URL Rewrite | 最新版 | [下載](https://www.iis.net/downloads/microsoft/url-rewrite) |
| Node.js | 18 以上 | 打包前端用，打包完可移除。[下載](https://nodejs.org/) |

---

## 部署步驟

### 第一步：建立資料庫

1. 開啟 SSMS，連線到 SQL Server
2. 執行 `01_MSSQL_Schema.sql` 建立資料庫和資料表
3. 設定管理員密碼：

```sql
USE [TaoyuanDMS];
GO

UPDATE [dbo].[Users]
SET [PasswordHash] = N'$2a$12$FKZzopwTn5hfT5i2FZzGruBim3s7aE7OFHgC3BTSkobNHHTyhib56',
    [UpdatedAt] = GETDATE()
WHERE [Username] = N'admin';
GO
```

4. 確認資料庫帳號有 `db_datareader` 和 `db_datawriter` 權限

---

### 第二步：部署後端

1. 修改 `appsettings.json` 中的連線字串：

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=TaoyuanDMS;User Id=您的帳號;Password=您的密碼;TrustServerCertificate=True;"
  }
}
```

2. 發佈後端：

```bash
dotnet publish -c Release -o ./publish
```

3. 將 `publish` 資料夾內容複製到伺服器，例如 `D:\inetpub\TaoyuanDMS\`

---

### 第三步：打包並部署前端

1. 確認 `.env.production` 設為：

```
VITE_API_BASE_URL=/api
```

2. 打包前端：

```bash
npm install
npm run build
```

3. 將 `dist` 資料夾內的**所有檔案**複製到後端的 `wwwroot` 資料夾：

```
D:\inetpub\TaoyuanDMS\wwwroot\
├── index.html
├── assets\
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── ...
```

> ⚠️ 複製的是 dist **裡面**的檔案，不是 dist 資料夾本身

---

### 第四步：設定 IIS

1. **建立應用程式集區**
   - 名稱：`TaoyuanDMS`
   - .NET CLR 版本：**沒有受控碼**
   - 管線模式：整合式

2. **建立網站**
   - 網站名稱：`TaoyuanDMS`
   - 應用程式集區：`TaoyuanDMS`
   - 實體路徑：`D:\inetpub\TaoyuanDMS`
   - 連接埠：`80`（或自訂）

3. **設定資料夾權限**
   - 對 `D:\inetpub\TaoyuanDMS` 新增 `IIS_IUSRS` 和 `IUSR`，給予讀取和執行權限

---

### 第五步：測試

1. 開啟瀏覽器，輸入 `http://localhost`
2. 應該看到歡迎頁面
3. 登入測試：
   - 帳號：`admin`
   - 密碼：`Admin@123`（請登入後立即修改）

---

## 日後更新

### 更新前端
1. 執行 `npm run build`
2. 將 `dist` 內容覆蓋到伺服器的 `wwwroot` 資料夾

### 更新後端
1. 在 IIS **停止網站**
2. 重新發佈並覆蓋伺服器檔案
3. **啟動網站**

---

## 常見問題

| 問題 | 解決方式 |
|------|----------|
| 500 錯誤 | 檢查 `appsettings.json` 連線字串是否正確 |
| 502.5 錯誤 | 確認安裝的是 .NET 8 **Hosting Bundle**，安裝後執行 `iisreset` |
| 登入失敗 | 確認資料庫帳號有權限、密碼雜湊值已更新 |
| 頁面重新整理 404 | 確認已安裝 URL Rewrite 模組 |

---

## 頁面清單

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/welcome` | 歡迎頁 | 系統首頁 |
| `/login` | 登入頁 | 輸入帳號密碼登入 |
| `/` | 首頁 | 檔案列表（需登入） |
| `/edit/:fileId` | 編輯器 | 編輯文件（需登入） |
| `/admin` | 管理頁 | 系統管理（需管理員） |
| `/profile` | 個人資料 | 修改個人資訊 |
| `/contractor` | 承包商申請 | 承包商申請表 |
| `/storage-config` | 儲存設定 | 儲存空間管理 |
| `/phonebook` | 通訊錄 | 電話簿 |
| `/recycle-bin` | 資源回收筒 | 已刪除檔案 |
