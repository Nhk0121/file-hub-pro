# 桃園區公所 文件管理系統 (TaoyuanDMS)

## 系統架構

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

前端（React + Vite）打包後放在後端（ASP.NET Core）的 `wwwroot` 資料夾內，由同一個 IIS 站台提供服務。

---

## 部署方式

👉 請參閱 **[backend/DEPLOY.md](backend/DEPLOY.md)** 取得完整的傻瓜式部署步驟。

---

## 專案結構

```
TaoyuanDMS/
├── src/                          ← React 前端原始碼
├── backend/
│   ├── TaoyuanDMS.API/           ← ASP.NET Core 後端
│   │   ├── Controllers/          ← API 控制器
│   │   ├── Services/             ← 商業邏輯
│   │   ├── Models/DTOs.cs        ← 資料傳輸物件
│   │   ├── Program.cs            ← 程式進入點
│   │   ├── appsettings.json      ← 後端設定檔
│   │   └── web.config            ← IIS 設定（SPA 路由重寫）
│   ├── SQL/
│   │   └── 001_CreateDatabase.sql ← 資料庫建立腳本（唯一標準）
│   └── DEPLOY.md                 ← 部署指南
├── .env.production               ← 前端環境變數
└── package.json                  ← 前端依賴
```

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

---

## 技術棧

| 層級 | 技術 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Tailwind CSS |
| 後端 | ASP.NET Core 8 + Dapper |
| 資料庫 | SQL Server (MSSQL) |
| 認證 | JWT + BCrypt |
| 部署 | IIS (單一站台) |
