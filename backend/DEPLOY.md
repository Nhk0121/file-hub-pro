# TaoyuanDMS 部署指南（傻瓜版）

> 照著做就對了，一步一步來 👇

---

## 📋 你需要先準備什麼？

| 軟體 | 去哪裡下載 |
|------|-----------|
| Windows Server 2016 以上（要有 IIS） | 伺服器本身 |
| SQL Server 2016 以上 | 伺服器本身 |
| .NET 8 Hosting Bundle | [點我下載](https://dotnet.microsoft.com/download/dotnet/8.0)（選 **Hosting Bundle**） |
| IIS URL Rewrite 模組 | [點我下載](https://www.iis.net/downloads/microsoft/url-rewrite) |
| Node.js 18 以上（打包前端用） | [點我下載](https://nodejs.org/) |

> ⚠️ 安裝完 .NET 8 Hosting Bundle 後，**一定要**開 CMD 執行 `iisreset`

---

## 🔨 步驟一：建立資料庫

1. 開啟 **SQL Server Management Studio (SSMS)**
2. 連線到你的 SQL Server
3. 點選「**新增查詢**」
4. 打開 `backend/SQL/001_CreateDatabase.sql` 這個檔案
5. 把裡面的 SQL **全部複製貼上**到查詢視窗
6. 按下「**執行**」按鈕
7. 看到 `TaoyuanDMS 資料庫建表完成！` 就代表成功了 ✅

### 設定管理員密碼

執行完建表後，**再開一個新查詢**，貼上以下 SQL 並執行：

```sql
USE [TaoyuanDMS];
GO

UPDATE [dbo].[Users]
SET [PasswordHash] = N'$2a$12$FKZzopwTn5hfT5i2FZzGruBim3s7aE7OFHgC3BTSkobNHHTyhib56',
    [UpdatedAt] = GETDATE()
WHERE [Username] = N'admin';
GO
```

> 這會把 admin 密碼設為 `Admin@123`，登入後請**立即修改**！

### 確認資料庫帳號權限

你用來連線的 SQL 帳號（例如 `sa_tpc`），需要有以下權限：
- `db_datareader`（讀取資料）
- `db_datawriter`（寫入資料）

---

## 🔨 步驟二：部署後端

### 2-1. 修改連線設定

打開 `backend/TaoyuanDMS.API/appsettings.json`，改成你自己的設定：

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=你的SQL伺服器;Database=TaoyuanDMS;User Id=你的帳號;Password=你的密碼;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "換成你自己的密鑰（至少32個字元）"
  },
  "Storage": {
    "BasePath": "E:\\DMS"
  }
}
```

> 💡 `BasePath` 是上傳檔案存放的資料夾，可以改成你想要的路徑

### 2-2. 發佈後端

在 `backend/TaoyuanDMS.API/` 資料夾內開 CMD，執行：

```bash
dotnet publish -c Release -o ./publish
```

### 2-3. 複製到伺服器

把 `publish` 資料夾裡的**所有內容**複製到伺服器上，例如：

```
D:\inetpub\TaoyuanDMS\
```

---

## 🔨 步驟三：打包並部署前端

### 3-1. 確認設定檔

打開專案根目錄的 `.env.production`，確認內容是：

```
VITE_API_BASE_URL=/api
```

### 3-2. 打包前端

在專案根目錄開 CMD，執行：

```bash
npm install
npm run build
```

### 3-3. 複製到後端的 wwwroot

打包完會產生一個 `dist` 資料夾，把 **dist 裡面的檔案**（不是 dist 資料夾本身！）複製到後端的 `wwwroot` 資料夾：

```
D:\inetpub\TaoyuanDMS\wwwroot\
├── index.html        ← 這個一定要有
├── assets\
│   ├── index-xxxxx.js
│   └── index-xxxxx.css
└── ...
```

> ⚠️ 常見錯誤：複製成 `wwwroot\dist\index.html` → ❌ 錯的！  
> 正確的是：`wwwroot\index.html` → ✅ 對的！

---

## 🔨 步驟四：設定 IIS

### 4-1. 建立應用程式集區

1. 打開「**IIS 管理員**」
2. 左邊點「**應用程式集區**」
3. 右邊點「**新增應用程式集區**」
4. 設定如下：
   - 名稱：`TaoyuanDMS`
   - .NET CLR 版本：**沒有受控碼**
   - 管線模式：**整合式**

### 4-2. 建立網站

1. 左邊點「**站台**」
2. 右邊點「**新增網站**」
3. 設定如下：
   - 網站名稱：`TaoyuanDMS`
   - 應用程式集區：`TaoyuanDMS`（選剛才建的）
   - 實體路徑：`D:\inetpub\TaoyuanDMS`（就是放 publish 內容的那個）
   - 連接埠：`80`（或你想要的 Port）

### 4-3. 設定資料夾權限

需要給 **兩個資料夾** 設定權限：

| 資料夾 | 給誰 | 權限 |
|--------|------|------|
| `D:\inetpub\TaoyuanDMS` | `IIS_IUSRS` 和 `IUSR` | 讀取和執行 |
| `E:\DMS`（檔案儲存路徑） | `IIS_IUSRS` 和 `IUSR` | **讀取 + 寫入** |

> 💡 `E:\DMS` 就是 appsettings.json 裡面 `Storage.BasePath` 設定的路徑

設定方式：對資料夾右鍵 → 內容 → 安全性 → 編輯 → 新增 → 輸入帳號名稱 → 勾選權限

---

## 🔨 步驟五：測試

1. 開瀏覽器，輸入 `http://localhost`（或你設定的 Port）
2. 應該看到歡迎頁面
3. 登入測試：
   - 帳號：`admin`
   - 密碼：`Admin@123`
4. **登入成功後請立即修改密碼！**

---

## 🔄 日後更新

### 只更新前端（改了畫面）

```bash
npm run build
```
然後把 `dist` 裡面的檔案覆蓋到伺服器的 `wwwroot` 資料夾

### 只更新後端（改了程式邏輯）

1. 在 IIS 管理員 → **停止**網站
2. 重新 `dotnet publish`，覆蓋伺服器檔案
3. **啟動**網站

---

## ❓ 常見問題

| 看到什麼錯誤 | 怎麼解決 |
|-------------|----------|
| 500 錯誤 | `appsettings.json` 的連線字串打錯了，或 SQL Server 連不上 |
| 502.5 錯誤 | 沒裝 .NET 8 **Hosting Bundle**，裝完要跑 `iisreset` |
| 登入失敗 | 確認有執行「設定管理員密碼」那段 SQL |
| 頁面重新整理變 404 | 沒裝 **URL Rewrite** 模組 |
| 上傳檔案失敗 | `E:\DMS` 資料夾沒給 IIS 帳號寫入權限 |

---

## 📊 資料表清單（10 張）

| # | 資料表 | 說明 | 預置資料 |
|---|--------|------|----------|
| 1 | Users | 使用者帳號 | 1 筆（admin） |
| 2 | UserRegistrations | 帳號申請紀錄 | 無 |
| 3 | Files | 檔案與資料夾 | 無 |
| 4 | TrashItems | 回收桶 | 無 |
| 5 | AuditLogs | 稽核日誌 | 無 |
| 6 | FolderPermissions | 資料夾權限 | 無 |
| 7 | PermanentZoneOverrides | 永久區跨組別權限 | 無 |
| 8 | EditLocks | 編輯鎖定 | 無 |
| 9 | DepartmentQuotas | 組別配額 | 32 筆（16組 × 2區） |
| 10 | DepartmentSections | 課別管理 | 無 |
