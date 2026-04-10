-- =============================================
-- TaoyuanDMS 資料庫建立腳本
-- 適用於 MSSQL (SQL Server 2019+)
-- =============================================

USE [master];
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'TaoyuanDMS')
BEGIN
    CREATE DATABASE [TaoyuanDMS]
    COLLATE Chinese_Taiwan_Stroke_CI_AS;
END
GO

USE [TaoyuanDMS];
GO

-- =============================================
-- 1. 使用者表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
CREATE TABLE [dbo].[Users] (
    [Id]            NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [Username]      NVARCHAR(50)   NOT NULL UNIQUE,
    [PasswordHash]  NVARCHAR(200)  NOT NULL,
    [DisplayName]   NVARCHAR(100)  NOT NULL,
    [Email]         NVARCHAR(200)  NULL,
    [Role]          NVARCHAR(20)   NOT NULL DEFAULT N'使用者',  -- 系統管理員/管理員/使用者/外包人員
    [ApplicantType] NVARCHAR(20)   NULL,                        -- 公司員工/外包人員
    [EmployeeCode]  NVARCHAR(20)   NULL,
    [Department]    NVARCHAR(50)   NULL,
    [Section]       NVARCHAR(50)   NULL,
    [JobTitle]      NVARCHAR(50)   NULL,
    [Phone]         NVARCHAR(30)   NULL,
    [Extension]     NVARCHAR(10)   NULL,
    [IsActive]      BIT            NOT NULL DEFAULT 1,
    [CreatedAt]     DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt]     DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
GO

-- 預設系統管理員（密碼: admin123，BCrypt hash）
IF NOT EXISTS (SELECT 1 FROM [dbo].[Users] WHERE [Username] = 'admin')
INSERT INTO [dbo].[Users] ([Id], [Username], [PasswordHash], [DisplayName], [Role], [ApplicantType])
VALUES ('admin-default', 'admin', '$2a$11$placeholder_hash_replace_me', N'系統管理員', N'系統管理員', N'公司員工');
GO

-- =============================================
-- 2. 帳號申請表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserRegistrations')
CREATE TABLE [dbo].[UserRegistrations] (
    [Id]            NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [ApplicantType] NVARCHAR(20)   NOT NULL,
    [Username]      NVARCHAR(50)   NOT NULL,
    [Password]      NVARCHAR(200)  NOT NULL,  -- 暫存明碼，核准後轉 hash
    [DisplayName]   NVARCHAR(100)  NOT NULL,
    [Email]         NVARCHAR(200)  NULL,
    [Department]    NVARCHAR(50)   NULL,
    [Section]       NVARCHAR(50)   NULL,
    [JobTitle]      NVARCHAR(50)   NULL,
    [Phone]         NVARCHAR(30)   NULL,
    [Extension]     NVARCHAR(10)   NULL,
    [Status]        NVARCHAR(10)   NOT NULL DEFAULT N'待審核', -- 待審核/已核准/已拒絕
    [ReviewedBy]    NVARCHAR(100)  NULL,
    [ReviewedAt]    DATETIME2      NULL,
    [RejectReason]  NVARCHAR(500)  NULL,
    [CreatedAt]     DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
GO

-- =============================================
-- 3. 檔案與資料夾表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Files')
CREATE TABLE [dbo].[Files] (
    [Id]            NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [Name]          NVARCHAR(255)  NOT NULL,
    [Type]          NVARCHAR(10)   NOT NULL,  -- file / folder
    [MimeType]      NVARCHAR(100)  NULL,
    [Size]          BIGINT         NULL,
    [ParentId]      NVARCHAR(36)   NULL REFERENCES [dbo].[Files]([Id]),
    [Content]       NVARCHAR(MAX)  NULL,      -- 文字檔內容（TXT/MD/HTML）
    [IsSystem]      BIT            NOT NULL DEFAULT 0,
    [FolderLevel]   NVARCHAR(20)   NULL,      -- zone / department / section
    [DiskPath]      NVARCHAR(500)  NULL,
    [CreatedBy]     NVARCHAR(100)  NOT NULL,
    [CreatedAt]     DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    [UpdatedAt]     DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
GO

CREATE NONCLUSTERED INDEX IX_Files_ParentId ON [dbo].[Files]([ParentId]);
GO

-- =============================================
-- 4. 回收桶表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'TrashItems')
CREATE TABLE [dbo].[TrashItems] (
    [Id]              NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [FileId]          NVARCHAR(36)   NOT NULL,
    [FileName]        NVARCHAR(255)  NOT NULL,
    [FileType]        NVARCHAR(10)   NOT NULL,
    [FileData]        NVARCHAR(MAX)  NULL,  -- 序列化的 FileItem JSON
    [OriginalParentId] NVARCHAR(36)  NULL,
    [DeletedBy]       NVARCHAR(100)  NOT NULL,
    [DeletedAt]       DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
GO

-- =============================================
-- 5. 稽核日誌表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'AuditLogs')
CREATE TABLE [dbo].[AuditLogs] (
    [Id]          NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [Timestamp]   DATETIME2      NOT NULL DEFAULT GETUTCDATE(),
    [UserId]      NVARCHAR(36)   NOT NULL,
    [UserName]    NVARCHAR(100)  NOT NULL,
    [Action]      NVARCHAR(50)   NOT NULL,
    [TargetName]  NVARCHAR(255)  NULL,
    [TargetId]    NVARCHAR(36)   NULL,
    [Details]     NVARCHAR(1000) NULL,
    [IpAddress]   NVARCHAR(50)   NULL
);
GO

CREATE NONCLUSTERED INDEX IX_AuditLogs_Timestamp ON [dbo].[AuditLogs]([Timestamp] DESC);
GO

-- =============================================
-- 6. 資料夾權限表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'FolderPermissions')
CREATE TABLE [dbo].[FolderPermissions] (
    [Id]          NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [FolderId]    NVARCHAR(36)   NOT NULL,
    [UserId]      NVARCHAR(36)   NOT NULL,
    [Permission]  NVARCHAR(20)   NOT NULL, -- 完整權限/僅下載/無權限
    CONSTRAINT UQ_FolderPerm UNIQUE ([FolderId], [UserId])
);
GO

-- =============================================
-- 7. 永久區跨組別權限表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'PermanentZoneOverrides')
CREATE TABLE [dbo].[PermanentZoneOverrides] (
    [Id]          NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [UserId]      NVARCHAR(36)   NOT NULL,
    [Departments] NVARCHAR(MAX)  NOT NULL  -- JSON array of department names
);
GO

-- =============================================
-- 8. 編輯鎖定表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'EditLocks')
CREATE TABLE [dbo].[EditLocks] (
    [FileId]    NVARCHAR(36)   NOT NULL PRIMARY KEY,
    [UserId]    NVARCHAR(36)   NOT NULL,
    [UserName]  NVARCHAR(100)  NOT NULL,
    [LockedAt]  DATETIME2      NOT NULL DEFAULT GETUTCDATE()
);
GO

-- =============================================
-- 9. 儲存空間配額表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'StorageQuotas')
CREATE TABLE [dbo].[StorageQuotas] (
    [Id]          NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [Department]  NVARCHAR(50)   NOT NULL,
    [Zone]        NVARCHAR(20)   NOT NULL,
    [QuotaMB]     INT            NOT NULL DEFAULT 10240,
    [UsedMB]      INT            NOT NULL DEFAULT 0,
    CONSTRAINT UQ_StorageQuota UNIQUE ([Department], [Zone])
);
GO

-- =============================================
-- 10. 課別管理表
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'DepartmentSections')
CREATE TABLE [dbo].[DepartmentSections] (
    [Id]          NVARCHAR(36)   NOT NULL PRIMARY KEY DEFAULT NEWID(),
    [Department]  NVARCHAR(50)   NOT NULL,
    [Section]     NVARCHAR(50)   NOT NULL,
    CONSTRAINT UQ_DeptSection UNIQUE ([Department], [Section])
);
GO

PRINT N'TaoyuanDMS 資料庫建表完成！';
GO
