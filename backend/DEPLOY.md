# TaoyuanDMS 後端部署指南

## 一、前置需求
- Windows Server 2019+
- IIS + URL Rewrite 模組
- .NET 8 Runtime + Hosting Bundle
- SQL Server 2019+

## 二、資料庫設定

1. 在 SQL Server Management Studio 執行 `backend/SQL/001_CreateDatabase.sql`
2. **重要**：修改 admin 預設密碼 hash，使用以下 C# 產生：
   ```csharp
   BCrypt.Net.BCrypt.HashPassword("your_password")
   ```

## 三、後端部署

1. 進入 `backend/TaoyuanDMS.API/` 目錄
2. 執行建置：
   ```bash
   dotnet publish -c Release -o ./publish
   ```
3. 修改 `publish/appsettings.json`：
   - `ConnectionStrings:DefaultConnection` → 你的 MSSQL 連線字串
   - `Jwt:Key` → 自訂金鑰（至少 32 字元）
   - `Storage:BasePath` → 實體檔案儲存路徑（如 `E:\DMS`）

4. 確認 `E:\DMS` 目錄已建立，且 IIS 應用程式集區帳號具讀寫權限

## 四、IIS 設定

1. 建立新網站，指向 `publish` 資料夾
2. 應用程式集區 → .NET CLR 版本設為「沒有受控碼」
3. `web.config` 已包含 SPA 路由重寫規則

## 五、前端部署

1. 在前端專案中，修改 `.env.production`：
   ```
   VITE_API_BASE_URL=/api
   ```
2. 執行 `npm run build`
3. 將 `dist/` 內所有檔案複製到後端 `publish/wwwroot/` 目錄

## 六、API 端點對照表

| 前端 Service | 後端路由 | 說明 |
|---|---|---|
| authService.login | POST /api/auth/login | 登入 |
| authService.logout | POST /api/auth/logout | 登出 |
| authService.getProfile | GET /api/auth/profile | 取得個人資料 |
| authService.updateProfile | PUT /api/auth/profile | 更新個人資料 |
| authService.changePassword | POST /api/auth/change-password | 變更密碼 |
| userService.getAll | GET /api/users | 取得所有使用者 |
| userService.create | POST /api/users | 新增使用者 |
| userService.update | PUT /api/users/:id | 更新使用者 |
| userService.remove | DELETE /api/users/:id | 刪除使用者 |
| userService.updateRole | PUT /api/users/:id/role | 更新角色 |
| userService.resetPassword | POST /api/users/:id/reset-password | 重置密碼 |
| userService.getRegistrations | GET /api/users/registrations | 取得申請列表 |
| userService.submitRegistration | POST /api/users/registrations | 提交申請 |
| userService.reviewRegistration | POST /api/users/registrations/:id/review | 審核申請 |
| fileService.getAll | GET /api/files | 取得所有檔案 |
| fileService.getChildren | GET /api/files?parentId=xxx | 取得子項目 |
| fileService.getById | GET /api/files/:id | 取得單一檔案 |
| fileService.createFolder | POST /api/files/folder | 建立資料夾 |
| fileService.upload | POST /api/files/upload | 上傳檔案 |
| fileService.moveToTrash | POST /api/files/:id/trash | 移至回收桶 |
| fileService.deleteItem | DELETE /api/files/:id | 永久刪除 |
| fileService.rename | PUT /api/files/:id/rename | 重新命名 |
| fileService.updateContent | PUT /api/files/:id/content | 更新內容 |
| fileService.download | GET /api/files/:id/download | 下載檔案 |
| fileService.addSection | POST /api/files/sections | 新增課別 |
| fileService.removeSection | DELETE /api/files/sections | 刪除課別 |
| trashService | /api/trash/* | 回收桶操作 |
| auditService | /api/audit/* | 稽核日誌 |
| permissionService | /api/permissions/* | 權限管理 |
| editLockService | /api/edit-locks/* | 編輯鎖定 |
| storageService | /api/storage/* | 儲存空間 |

## 七、注意事項

- JWT Token 有效期為 8 小時
- 密碼使用 BCrypt 加密
- 文字檔（TXT/MD/HTML/CSV/JSON/XML）上傳時會自動讀取內容存入資料庫
- 所有操作皆自動記錄稽核日誌
- 刪除使用者為軟刪除（IsActive = 0）
