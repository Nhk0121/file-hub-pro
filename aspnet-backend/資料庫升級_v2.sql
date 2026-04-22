-- ========================================
-- 文件管理系統 資料庫升級腳本 v2
-- 對應改良版本：安全性、一致性、功能補強
-- 執行前請先備份資料庫！
-- ========================================

USE [文件管理系統DB];
GO

-- ========================================
-- C1: 操作紀錄補充帳號欄位
-- ========================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'操作紀錄') AND name = N'帳號編號'
)
BEGIN
    ALTER TABLE [dbo].[操作紀錄]
        ADD [帳號編號] INT NULL,
            [登入帳號] NVARCHAR(50) NULL;
    PRINT N'已新增 操作紀錄.帳號編號 / 登入帳號 欄位';
END
GO

-- ========================================
-- C1: 操作紀錄帳號欄位索引
-- ========================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'操作紀錄') AND name = N'IX_操作紀錄_帳號編號'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_操作紀錄_帳號編號
        ON [dbo].[操作紀錄]([帳號編號]);
    PRINT N'已建立 IX_操作紀錄_帳號編號 索引';
END
GO

-- ========================================
-- A2: 組別設定移除 IP 審核欄位（改由帳號角色判斷）
-- 注意：若仍需保留 IP 欄位作為參考，可跳過此段
-- ========================================
-- 以下為選擇性執行，若確認已改用帳號角色審核，可取消註解：
/*
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'組別設定') AND name = N'負責人IP'
)
BEGIN
    ALTER TABLE [dbo].[組別設定]
        DROP COLUMN [負責人IP], [備用負責人IP];
    PRINT N'已移除 組別設定 的 IP 審核欄位（改由帳號角色判斷）';
END
*/
GO

-- ========================================
-- B1: 資料夾資料表補充實體路徑欄位（若尚未存在）
-- ========================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'資料夾') AND name = N'實體路徑'
)
BEGIN
    ALTER TABLE [dbo].[資料夾]
        ADD [實體路徑] NVARCHAR(1000) NULL;
    PRINT N'已新增 資料夾.實體路徑 欄位';
END
GO

-- ========================================
-- B1: 資料夾資料表補充刪除者欄位（若尚未存在）
-- ========================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'資料夾') AND name = N'刪除者IP'
)
BEGIN
    ALTER TABLE [dbo].[資料夾]
        ADD [刪除時間] DATETIME NULL,
            [刪除者IP] NVARCHAR(50) NULL,
            [建立者IP] NVARCHAR(50) NULL;
    PRINT N'已新增 資料夾 刪除/建立 欄位';
END
GO

-- ========================================
-- 檢查並補充 檔案主檔.資料夾編號 欄位（若尚未存在）
-- ========================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'檔案主檔') AND name = N'資料夾編號'
)
BEGIN
    ALTER TABLE [dbo].[檔案主檔]
        ADD [資料夾編號] INT NULL;
    PRINT N'已新增 檔案主檔.資料夾編號 欄位';
END
GO

-- ========================================
-- 補充索引：資料夾.父資料夾編號
-- ========================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'資料夾') AND name = N'IX_資料夾_父資料夾編號'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_資料夾_父資料夾編號
        ON [dbo].[資料夾]([父資料夾編號]);
    PRINT N'已建立 IX_資料夾_父資料夾編號 索引';
END
GO

-- ========================================
-- 補充索引：檔案主檔.資料夾編號
-- ========================================
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'檔案主檔') AND name = N'IX_檔案主檔_資料夾編號'
)
BEGIN
    CREATE NONCLUSTERED INDEX IX_檔案主檔_資料夾編號
        ON [dbo].[檔案主檔]([資料夾編號]);
    PRINT N'已建立 IX_檔案主檔_資料夾編號 索引';
END
GO

PRINT N'資料庫升級 v2 完成！';
GO
