# 桃園區公所 文件管理系統 (TaoyuanDMS) - 前端

## 系統架構

```
┌─────────────────────┐     ┌─────────────────────┐     ┌──────────────┐
│  前端 (本專案)        │────▶│  後端 ASP.NET Core   │────▶│  MSSQL 資料庫  │
│  React + Vite        │     │  Web API             │     │  TaoyuanDMS  │
│  部署於 IIS 站台 A    │     │  部署於 IIS 站台 B    │     │              │
└─────────────────────┘     └─────────────────────┘     └──────────────┘
```

---

## 安裝步驟（從零開始）

### 前置需求

| 軟體 | 版本 | 說明 |
|------|------|------|
| Node.js | 18 以上 | 用來打包前端，安裝完即可刪除 |
| Windows Server | 2016 以上 | 已安裝 IIS |
| .NET 8 Runtime | 最新版 | 後端 API 執行環境 |
| SQL Server | 2016 以上 | 資料庫（您已完成） |

---

### 第一步：下載專案

從 GitHub 下載 ZIP 或使用 git clone：

```bash
git clone https://github.com/你的帳號/你的專案名.git
cd 你的專案名
```

---

### 第二步：設定後端 API 位址

打開 `.env.production` 檔案，修改為您的後端 API 實際位址：

```
VITE_API_BASE_URL=https://你的伺服器IP/api
```

**範例：**
- 如果後端跟前端在同一台伺服器：`https://localhost:5001/api`
- 如果後端在另一台伺服器：`https://192.168.1.100/api`

---

### 第三步：安裝套件並打包

在專案根目錄開啟 **命令提示字元** 或 **PowerShell**，執行：

```bash
# 1. 安裝所需套件（第一次需要，之後不用）
npm install

# 2. 打包產生部署檔案
npm run build
```

打包完成後，會產生一個 `dist` 資料夾，裡面就是要放到 IIS 的所有檔案。

---

### 第四步：部署到 IIS

1. **建立 IIS 網站**
   - 開啟 IIS 管理員
   - 右鍵「網站」→「新增網站」
   - 網站名稱：`TaoyuanDMS-Frontend`
   - 實體路徑：指向您的 `dist` 資料夾位置（例如 `C:\inetpub\TaoyuanDMS\frontend`）
   - 連接埠：設定您要的 Port（例如 80 或 8080）

2. **複製檔案**
   - 將 `dist` 資料夾內的**所有檔案**複製到 IIS 網站的實體路徑

3. **確認 web.config 存在**
   - `dist` 資料夾內應該已有 `web.config`（打包時自動包含）
   - 這個檔案讓 IIS 支援 SPA 路由（頁面重新整理不會 404）

4. **安裝 IIS URL Rewrite 模組**
   - 如果尚未安裝，請下載安裝：https://www.iis.net/downloads/microsoft/url-rewrite
   - 這是 `web.config` 裡的路由規則所必需的

5. **測試**
   - 開啟瀏覽器，輸入 `http://你的伺服器IP:埠號`
   - 應該會看到歡迎頁面，點擊登入可前往登入頁

---

### 第五步：設定後端 CORS（重要！）

後端 ASP.NET Core 的 `Program.cs` 中需要允許前端網址，確認 CORS 設定：

```csharp
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://你的前端網址:埠號")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});
```

---

## 頁面清單

| 路徑 | 頁面 | 說明 |
|------|------|------|
| `/welcome` | 歡迎頁 | 系統首頁，未登入時顯示 |
| `/login` | 登入頁 | 輸入帳號密碼登入 |
| `/` | 首頁 | 檔案列表（需登入） |
| `/edit/:fileId` | 編輯器 | 編輯文件（需登入） |
| `/admin` | 管理頁 | 系統管理（需管理員） |
| `/profile` | 個人資料 | 修改個人資訊（需登入） |
| `/contractor` | 承包商申請 | 承包商申請表（需登入） |
| `/storage-config` | 儲存設定 | 儲存空間管理（需登入） |
| `/phonebook` | 通訊錄 | 電話簿（需登入） |
| `/recycle-bin` | 資源回收筒 | 已刪除檔案（需登入） |

---

## 預設管理員帳號

- 帳號：`admin`
- 密碼：`Admin@123`（請登入後立即修改）

---

## 更新前端

日後要更新前端時：

1. 從 GitHub 拉取最新程式碼
2. 執行 `npm install` 和 `npm run build`
3. 將 `dist` 資料夾內容覆蓋到 IIS 網站路徑
4. 在 IIS 管理員重新啟動網站

---

## 常見問題

### Q: 頁面重新整理出現 404？
A: 確認 IIS 已安裝 URL Rewrite 模組，且 `web.config` 存在於網站根目錄。

### Q: 登入後出現網路錯誤？
A: 確認 `.env.production` 中的 API 位址正確，且後端 CORS 設定允許前端網址。

### Q: npm install 失敗？
A: 確認 Node.js 版本 18 以上（執行 `node -v` 確認）。

### Q: 如何在沒有 Node.js 的伺服器部署？
A: 可在您的個人電腦執行 `npm run build`，再將 `dist` 資料夾複製到伺服器即可。伺服器不需要安裝 Node.js。
