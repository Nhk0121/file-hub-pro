# TaoyuanDMS 部署指南

> 完整部署步驟請參閱：**完整部署指南.md**

## 快速參考

### 前置需求
- Windows Server 2019+ / IIS + URL Rewrite
- .NET 8 Hosting Bundle（安裝後 `iisreset`）
- SQL Server 2016+

### 資料庫
1. 在 SSMS 執行 `01_MSSQL_Schema.sql`（建庫＋建表＋預置資料一次完成）
2. 更新 admin 密碼 hash

### 後端
1. `dotnet publish -c Release -o ./publish`
2. 修改 `appsettings.json`（連線字串、JWT Key、Storage Path）
3. 複製到伺服器

### 前端
1. `.env.production` 設為 `VITE_API_BASE_URL=/api`
2. `npm run build`
3. `dist/` 內容複製到後端 `wwwroot/`

### IIS
- 應用程式集區：.NET CLR = 沒有受控碼
- 站台指向 publish 資料夾
- `E:\DMS` 需給 IIS 帳號讀寫權限

### 資料表清單（10 張）

| 資料表 | 說明 |
|--------|------|
| Users | 使用者 |
| UserRegistrations | 帳號申請 |
| Files | 檔案與資料夾 |
| TrashItems | 回收桶 |
| AuditLogs | 稽核日誌 |
| FolderPermissions | 資料夾權限 |
| PermanentZoneOverrides | 永久區跨組別權限 |
| EditLocks | 編輯鎖定 |
| DepartmentQuotas | 組別配額（含 32 筆預置） |
| DepartmentSections | 課別管理 |
