# TaoyuanDMS 部署指南（傻瓜版）

> 照著做就對了，一步一步來 👇
> 
> 💡 本指南所有範例都使用以下假設值，請替換成你自己的：
> - SQL Server 帳號：`sa_tpc`，密碼：`MyP@ssw0rd`
> - 伺服器名稱：`MYSERVER\SQLEXPRESS`
> - 部署目錄：`D:\inetpub\TaoyuanDMS`
> - 檔案儲存目錄：`E:\DMS`
> - 網站 Port：`80`

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

### 如何開啟 IIS 功能

如果你的 Windows Server 還沒開啟 IIS，請這樣做：

1. 開啟「**伺服器管理員**」（Server Manager）
2. 點「**管理**」→「**新增角色及功能**」
3. 一路按「下一步」直到「**伺服器角色**」頁面
4. 勾選「**Web 伺服器 (IIS)**」
5. 彈出的視窗按「新增功能」
6. 繼續按「下一步」直到完成安裝

> ⚠️ 安裝完 .NET 8 Hosting Bundle 後，**一定要**開 CMD 執行：
> ```
> iisreset
> ```
> 如果沒執行 iisreset，IIS 會認不到 .NET 8，部署後會出 502.5 錯誤。

---

## 🔨 步驟一：建立資料庫

1. 開啟 **SQL Server Management Studio (SSMS)**
2. 連線到你的 SQL Server（畫面如下）：
   ```
   伺服器類型：資料庫引擎
   伺服器名稱：MYSERVER\SQLEXPRESS    ← 改成你自己的
   驗證：        SQL Server 驗證       ← 或 Windows 驗證
   登入：        sa_tpc                ← 你的帳號
   密碼：        MyP@ssw0rd            ← 你的密碼
   ```
3. 連線成功後，點選工具列的「**新增查詢**」（或按 Ctrl+N）
4. 用記事本打開 `backend/SQL/001_CreateDatabase.sql`
5. **Ctrl+A 全選** → **Ctrl+C 複製** → **Ctrl+V 貼上**到 SSMS 的查詢視窗
6. 按下工具列的「**執行**」按鈕（或按 **F5**）
7. 下方訊息區看到 `TaoyuanDMS 資料庫建表完成！` 就代表成功了 ✅

> 💡 SQL 腳本會自動建立 admin 帳號，預設密碼是 `Admin@123`。
> 不需要額外執行任何 SQL，建表完就可以用了！

### 確認資料庫帳號權限

如果你是用 **SQL Server 帳號**（例如 `sa_tpc`）連線，請確認該帳號有以下權限：

1. 在 SSMS 左側展開「**安全性**」→「**登入**」
2. 對你的帳號（例如 `sa_tpc`）**右鍵** →「**屬性**」
3. 左邊選「**使用者對應**」
4. 上方勾選 `TaoyuanDMS` 資料庫
5. 下方勾選：
   - ✅ `db_datareader`（讀取權限）
   - ✅ `db_datawriter`（寫入權限）
6. 按「確定」

> 💡 如果你用的是 **Windows 驗證**（Trusted_Connection），通常不需要額外設定權限。

---

## 🔨 步驟二：設定並發佈後端

### 2-1. 修改連線設定

用記事本打開 `backend/TaoyuanDMS.API/appsettings.json`，改成你自己的設定。

**📌 範例一：使用 SQL Server 帳號（最常見）**

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=MYSERVER\\SQLEXPRESS;Database=TaoyuanDMS;User Id=sa_tpc;Password=MyP@ssw0rd;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "TaoyuanDistrict_DMS_Secret_Key_2024!@#$%^&*()",
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

**📌 範例二：使用 Windows 驗證（同一台電腦上）**

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.;Database=TaoyuanDMS;Trusted_Connection=True;TrustServerCertificate=True;"
  },
  "Jwt": {
    "Key": "TaoyuanDistrict_DMS_Secret_Key_2024!@#$%^&*()",
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

> ⚠️ **重要提醒**：
> - `Server=.` 表示本機，等同於 `Server=localhost`
> - `Server=MYSERVER\\SQLEXPRESS` 中的 `\\` 在 JSON 裡代表一個 `\`
> - `Jwt:Key` **一定要改成你自己的密鑰**！至少 32 個字元，越長越安全
> - `Storage:BasePath` 是檔案上傳存放的路徑，可以改成你想要的位置（例如 `D:\\FileStorage`）

### 2-2. 發佈後端

1. 打開**檔案總管**，進入 `backend\TaoyuanDMS.API\` 資料夾
2. 在路徑列（上方顯示路徑的地方）**點一下**，輸入 `cmd`，按 **Enter**
   - 這樣就會在這個資料夾開一個 CMD 視窗
3. 在 CMD 輸入以下指令，按 Enter：

```bash
dotnet publish -c Release -o ./publish
```

4. 等待執行完畢，看到類似以下訊息就代表成功：

```
TaoyuanDMS.API -> D:\file-hub-pro-main\backend\TaoyuanDMS.API\publish\
```

> ✅ 看到「建置 成功」就代表 OK
> ⚠️ 如果看到紅色錯誤，請確認 .NET 8 SDK 有正確安裝

### 2-3. 複製到伺服器

把 `publish` 資料夾裡的**所有內容**複製到伺服器上的部署目錄。

**操作方式**：
1. 在伺服器上建立資料夾：`D:\inetpub\TaoyuanDMS`
2. 打開 `backend\TaoyuanDMS.API\publish\` 資料夾
3. **Ctrl+A 全選** → **Ctrl+C 複製**
4. 到 `D:\inetpub\TaoyuanDMS\` → **Ctrl+V 貼上**

完成後，部署目錄應該長這樣：

```
D:\inetpub\TaoyuanDMS\
├── TaoyuanDMS.API.dll     ← 主程式（⚠️ 這個一定要在根目錄）
├── TaoyuanDMS.API.exe     ← 執行檔
├── appsettings.json       ← 設定檔（剛才改過的）
├── web.config             ← IIS 設定（自動產生的）
├── wwwroot\               ← 等一下放前端檔案
└── ...其他 .dll 檔案
```

> ⚠️ **常見錯誤**：
> - ❌ 錯：`D:\inetpub\TaoyuanDMS\publish\TaoyuanDMS.API.dll`（多包了一層 publish）
> - ✅ 對：`D:\inetpub\TaoyuanDMS\TaoyuanDMS.API.dll`（直接在部署目錄下）

---

## 🔨 步驟三：打包並部署前端

### 3-1. 確認設定檔

打開專案根目錄的 `.env.production`，確認內容是：

```
VITE_API_BASE_URL=/api
```

> 這個通常不用改，預設就是對的

### 3-2. 打包前端

1. 打開**檔案總管**，進入**專案根目錄**（就是有 `package.json` 的那個資料夾，**不是** backend 裡面）
2. 在路徑列輸入 `cmd` 按 Enter
3. 依序執行以下兩個指令：

```bash
npm install
```

等它跑完（可能需要 1-2 分鐘），再執行：

```bash
npm run build
```

4. 執行完會產生一個 `dist` 資料夾

> 💡 如果 `npm install` 顯示 vulnerabilities 警告，可以忽略（不影響使用）

### 3-3. 複製到後端的 wwwroot

1. 打開剛產生的 `dist` 資料夾
2. **Ctrl+A 全選** → **Ctrl+C 複製**
3. 到伺服器的 `D:\inetpub\TaoyuanDMS\wwwroot\` → **Ctrl+V 貼上**

完成後，wwwroot 應該長這樣：

```
D:\inetpub\TaoyuanDMS\wwwroot\
├── index.html              ← ✅ 這個一定要在 wwwroot 根目錄
├── robots.txt
├── assets\
│   ├── index-Ab1Cd2Ef.js   ← 檔名每次 build 都不一樣，正常的
│   └── index-Gh3Ij4Kl.css
└── ...
```

> ⚠️ **最常犯的錯誤**：
> - ❌ 錯：`wwwroot\dist\index.html`（你把整個 dist 資料夾複製進去了）
> - ✅ 對：`wwwroot\index.html`（要打開 dist，複製**裡面的檔案**）

---

## 🔨 步驟四：建立檔案儲存資料夾

在伺服器上建立檔案上傳的存放目錄（就是 `appsettings.json` 裡 `Storage:BasePath` 設定的路徑）：

**操作方式**：
1. 打開**檔案總管**
2. 到 `E:\` 磁碟
3. 右鍵 →「**新增**」→「**資料夾**」
4. 命名為 `DMS`

最終路徑為：`E:\DMS\`

> 💡 如果你把 BasePath 改成了其他路徑（例如 `D:\FileStorage`），就建對應的資料夾

---

## 🔨 步驟五：設定 IIS

### 5-1. 建立應用程式集區

1. 按 **Windows 鍵**，搜尋「**IIS**」，打開「**Internet Information Services (IIS) 管理員**」
2. 左側面板點「**應用程式集區**」
3. 右側「動作」面板點「**新增應用程式集區**」
4. 填寫如下：
   ```
   名稱：           TaoyuanDMS
   .NET CLR 版本：  沒有受控碼        ← ⚠️ 一定要選這個！不要選 v4.0
   管線模式：       整合式
   ```
5. 按「確定」

> ⚠️ 為什麼選「沒有受控碼」？因為 .NET 8 是透過 AspNetCoreModule 載入，不是用傳統 CLR。
> 如果選了 v4.0 會導致 502.5 錯誤。

### 5-2. 建立網站

1. 左側面板點「**站台**」
2. 右側「動作」面板點「**新增網站**」
3. 填寫如下：
   ```
   網站名稱：       TaoyuanDMS
   應用程式集區：   TaoyuanDMS        ← 選剛才建的那個
   實體路徑：       D:\inetpub\TaoyuanDMS   ← 放 publish 內容的那個資料夾
   連接埠：         80                ← 或你想要的 Port（例如 8080）
   ```
4. 按「確定」

> ⚠️ 如果出現「無法啟動網站，因為 Port 80 已被使用」：
> 1. 左側展開「站台」
> 2. 對「**Default Web Site**」右鍵 →「**停止**」
> 3. 再重新啟動 TaoyuanDMS 網站

### 5-3. 設定資料夾權限

需要給 **兩個資料夾** 設定權限：

| 資料夾 | 給誰 | 權限 | 原因 |
|--------|------|------|------|
| `D:\inetpub\TaoyuanDMS` | `IIS_IUSRS` | 讀取和執行 | IIS 需要讀取程式檔案 |
| `E:\DMS` | `IIS_IUSRS` | **完全控制** | 系統需要讀寫上傳的檔案 |

**設定方式**（每個資料夾都要做一次）：

1. 在檔案總管找到該資料夾
2. **右鍵** →「**內容**」（Properties）
3. 切到「**安全性**」分頁
4. 按「**編輯**」
5. 按「**新增**」
6. 在輸入框輸入 `IIS_IUSRS`
7. 按「**檢查名稱**」→ 確認它變成 `電腦名稱\IIS_IUSRS`
8. 按「確定」
9. 在權限清單勾選對應的權限：
   - 部署目錄：勾 ✅「讀取和執行」
   - DMS 目錄：勾 ✅「完全控制」
10. 按「確定」→「確定」

> 💡 如果「檢查名稱」找不到 `IIS_IUSRS`，確認 IIS 已正確安裝。

---

## 🔨 步驟六：測試

### 6-1. 基本測試

1. 開瀏覽器（建議用 Chrome 或 Edge）
2. 在網址列輸入：
   ```
   http://localhost
   ```
   （如果你設定的 Port 不是 80，要改成 `http://localhost:8080`）
3. 應該看到系統的歡迎頁面（Landing Page）

### 6-2. 登入測試

1. 點「**登入**」按鈕
2. 輸入：
   ```
   帳號：admin
   密碼：Admin@123
   ```
3. 按「登入」
4. ✅ 看到系統主畫面（檔案管理頁面）就代表部署成功！

### 6-3. 功能測試清單

| # | 測試項目 | 怎麼測 | 預期結果 |
|---|---------|--------|---------|
| 1 | 登入 | 用 admin / Admin@123 登入 | 成功進入主畫面 |
| 2 | 建立資料夾 | 在主畫面新增一個資料夾 | 資料夾出現在列表中 |
| 3 | 上傳檔案 | 上傳一個小檔案（如 .txt） | 檔案出現在列表中 |
| 4 | 下載檔案 | 點擊剛上傳的檔案下載 | 能正常下載 |
| 5 | 頁面重新整理 | 按 F5 或 Ctrl+R | 頁面正常顯示（不會 404） |

> 🔒 **登入成功後，請立即到個人資料頁修改密碼！**

---

## 🔄 日後更新

### 只更新前端（改了畫面、樣式）

```bash
# 步驟 1：在專案根目錄重新打包
npm run build

# 步驟 2：把 dist 資料夾裡面的檔案複製到伺服器
#         覆蓋 D:\inetpub\TaoyuanDMS\wwwroot\ 裡的所有檔案

# 步驟 3：清除瀏覽器快取
#         按 Ctrl+Shift+Delete → 清除快取 → 重新整理頁面
```

### 只更新後端（改了程式邏輯、API）

```bash
# 步驟 1：先停止 IIS 網站
#         IIS 管理員 → 對 TaoyuanDMS 網站右鍵 →「停止」

# 步驟 2：重新發佈
cd backend\TaoyuanDMS.API
dotnet publish -c Release -o ./publish

# 步驟 3：把 publish 裡的檔案覆蓋到伺服器部署目錄
#         ⚠️ 不要覆蓋 wwwroot 資料夾！只覆蓋 .dll 和 .exe 等檔案
#
#         簡單做法：
#         1. 先刪除 D:\inetpub\TaoyuanDMS\ 裡的 .dll 和 .exe 檔案
#            （不要刪 wwwroot 資料夾和 appsettings.json！）
#         2. 再把 publish 裡的檔案複製過去

# 步驟 4：回 IIS 管理員 →「啟動」網站
```

### 前後端都更新

按以下順序操作：

1. **停站**：IIS 管理員 → 停止 TaoyuanDMS 網站
2. **更新後端**：`dotnet publish` → 覆蓋 .dll/.exe 檔案（保留 wwwroot 和 appsettings.json）
3. **更新前端**：`npm run build` → 覆蓋 wwwroot 裡的檔案
4. **啟站**：IIS 管理員 → 啟動 TaoyuanDMS 網站

---

## ❓ 常見問題排解

| 現象 | 原因 | 解決方式 |
|------|------|----------|
| 網頁顯示 **500 錯誤** | 資料庫連不上 | 檢查 `appsettings.json` 的連線字串是否正確。用 SSMS 試連看看能不能連上 |
| 網頁顯示 **502.5 錯誤** | .NET 環境沒裝好 | 1. 重新安裝 .NET 8 **Hosting Bundle**<br>2. 執行 `iisreset`<br>3. 確認應用程式集區選了「沒有受控碼」 |
| 登入失敗 | 密碼 hash 不正確 | 確認有執行完整的 `001_CreateDatabase.sql`（重跑一次也可以，腳本有防重複） |
| 頁面重新整理變 **404** | 缺少 URL Rewrite | 安裝 [IIS URL Rewrite 模組](https://www.iis.net/downloads/microsoft/url-rewrite)，裝完 `iisreset` |
| 上傳檔案失敗 | 儲存目錄沒權限 | 確認 `E:\DMS` 已建立，且 `IIS_IUSRS` 有**完全控制**權限 |
| 畫面空白 | 前端檔案放錯位置 | 確認 `wwwroot\index.html` 存在（不是 `wwwroot\dist\index.html`） |
| 顯示 IIS 預設頁 | 網站沒指對路徑 | 確認 IIS 網站實體路徑指向 `D:\inetpub\TaoyuanDMS`（有 .dll 檔的那個） |
| API 回傳 **401** | JWT 設定不對 | 確認 `appsettings.json` 裡 `Jwt` 三個值都有填，且 Key 至少 32 字元 |
| 網站啟動但很慢 | 第一次載入要暖機 | 正常現象，第一次請求約需 5-10 秒，之後就快了 |

---

## 📁 完整的目錄結構參考

部署完成後，伺服器上的目錄結構應該如下：

```
D:\inetpub\TaoyuanDMS\               ← IIS 網站指向這裡
├── TaoyuanDMS.API.dll                ← 後端主程式
├── TaoyuanDMS.API.exe                ← 執行檔
├── appsettings.json                  ← 連線設定（你改過的）
├── web.config                        ← IIS 設定（自動產生，不用改）
├── Microsoft.*.dll                   ← 框架 DLL（很多個，正常的）
├── System.*.dll                      ← 系統 DLL
├── wwwroot\                          ← 前端檔案
│   ├── index.html                    ← 前端首頁
│   ├── robots.txt
│   └── assets\
│       ├── index-Ab1Cd2Ef.js         ← JS 打包檔
│       └── index-Gh3Ij4Kl.css        ← CSS 打包檔
└── ...

E:\DMS\                               ← 檔案儲存區（上傳的檔案都在這）
├── permanent\                         ← 永久區（系統自動建立）
└── temporary\                         ← 暫存區（系統自動建立）
```

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
