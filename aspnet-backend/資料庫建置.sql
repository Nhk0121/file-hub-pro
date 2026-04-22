-- ========================================
-- 文件管理系統 資料庫建置腳本
-- 資料庫名稱: 文件管理系統DB
-- 建立日期: 民國114年
-- ========================================

USE master;
GO

-- 建立資料庫
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'文件管理系統DB')
BEGIN
    CREATE DATABASE [文件管理系統DB]
    COLLATE Chinese_Taiwan_Stroke_CI_AS;
END
GO

USE [文件管理系統DB];
GO

-- ========================================
-- 組別資料表
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='組別設定' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[組別設定] (
        [組別編號]      INT IDENTITY(1,1) PRIMARY KEY,
        [組別名稱]      NVARCHAR(50) NOT NULL,
        [組別代碼]      NVARCHAR(20) NOT NULL UNIQUE,
        [負責人姓名]    NVARCHAR(50),
        [負責人IP]      NVARCHAR(50),
        [備用負責人IP]  NVARCHAR(50),
        [建立時間]      DATETIME DEFAULT GETDATE(),
        [是否啟用]      BIT DEFAULT 1
    );
END
GO

-- ========================================
-- 允許上傳執行檔的IP設定
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='執行檔IP白名單' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[執行檔IP白名單] (
        [白名單編號]    INT IDENTITY(1,1) PRIMARY KEY,
        [IP位址]        NVARCHAR(50) NOT NULL,
        [說明]          NVARCHAR(200),
        [建立者]        NVARCHAR(100),
        [建立時間]      DATETIME DEFAULT GETDATE(),
        [是否啟用]      BIT DEFAULT 1
    );
END
GO

-- ========================================
-- 檔案主資料表
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='檔案主檔' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[檔案主檔] (
        [檔案編號]      INT IDENTITY(1,1) PRIMARY KEY,
        [組別編號]      INT NOT NULL,
        [儲存區類型]    NVARCHAR(10) NOT NULL CHECK ([儲存區類型] IN (N'永久區', N'時效區', N'資源回收桶')),
        [原始檔名]      NVARCHAR(500) NOT NULL,
        [儲存檔名]      NVARCHAR(500) NOT NULL,
        [檔案路徑]      NVARCHAR(1000) NOT NULL,
        [檔案大小]      BIGINT,
        [檔案類型]      NVARCHAR(50),
        [副檔名]        NVARCHAR(20),
        [上傳者IP]      NVARCHAR(50),
        [上傳時間]      DATETIME DEFAULT GETDATE(),
        [到期時間]      DATETIME,
        [審核狀態]      NVARCHAR(20) DEFAULT N'待審核' CHECK ([審核狀態] IN (N'待審核', N'已通過', N'未通過', N'不需審核')),
        [審核者IP]      NVARCHAR(50),
        [審核時間]      DATETIME,
        [審核備註]      NVARCHAR(500),
        [是否刪除]      BIT DEFAULT 0,
        [刪除時間]      DATETIME,
        [刪除者IP]      NVARCHAR(50),
        [描述]          NVARCHAR(1000),
        [版本號]        INT DEFAULT 1,
        [父檔案編號]    INT,
        FOREIGN KEY ([組別編號]) REFERENCES [組別設定]([組別編號])
    );
END
GO

-- ========================================
-- 操作紀錄資料表 (稽核核心)
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='操作紀錄' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[操作紀錄] (
        [紀錄編號]      BIGINT IDENTITY(1,1) PRIMARY KEY,
        [檔案編號]      INT,
        [操作類型]      NVARCHAR(20) NOT NULL CHECK ([操作類型] IN (N'上傳', N'下載', N'預覽', N'編輯', N'刪除', N'審核', N'移動', N'登入', N'登出')),
        [操作者IP]      NVARCHAR(50) NOT NULL,
        [操作者主機名]  NVARCHAR(200),
        [操作時間]      DATETIME DEFAULT GETDATE(),
        [操作結果]      NVARCHAR(20) DEFAULT N'成功' CHECK ([操作結果] IN (N'成功', N'失敗', N'拒絕')),
        [失敗原因]      NVARCHAR(500),
        [操作前內容]    NVARCHAR(MAX),
        [操作後內容]    NVARCHAR(MAX),
        [檔案名稱]      NVARCHAR(500),
        [備註]          NVARCHAR(1000),
        FOREIGN KEY ([檔案編號]) REFERENCES [檔案主檔]([檔案編號])
    );
END
GO

-- ========================================
-- 資安稽核資料表
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='資安稽核紀錄' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[資安稽核紀錄] (
        [稽核編號]      BIGINT IDENTITY(1,1) PRIMARY KEY,
        [稽核類型]      NVARCHAR(50) NOT NULL,
        [風險等級]      NVARCHAR(10) NOT NULL CHECK ([風險等級] IN (N'低', N'中', N'高', N'嚴重')),
        [來源IP]        NVARCHAR(50),
        [目標資源]      NVARCHAR(500),
        [事件描述]      NVARCHAR(1000),
        [發生時間]      DATETIME DEFAULT GETDATE(),
        [處理狀態]      NVARCHAR(20) DEFAULT N'未處理',
        [處理備註]      NVARCHAR(500),
        [處理時間]      DATETIME
    );
END
GO

-- ========================================
-- 個資稽核資料表
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='個資稽核紀錄' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[個資稽核紀錄] (
        [稽核編號]      BIGINT IDENTITY(1,1) PRIMARY KEY,
        [檔案編號]      INT,
        [偵測類型]      NVARCHAR(50),
        [偵測內容]      NVARCHAR(MAX),
        [操作者IP]      NVARCHAR(50),
        [操作類型]      NVARCHAR(20),
        [偵測時間]      DATETIME DEFAULT GETDATE(),
        [風險等級]      NVARCHAR(10),
        [處理狀態]      NVARCHAR(20) DEFAULT N'未處理',
        FOREIGN KEY ([檔案編號]) REFERENCES [檔案主檔]([檔案編號])
    );
END
GO

-- ========================================
-- 系統設定資料表
-- ========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='系統設定' AND xtype='U')
BEGIN
    CREATE TABLE [dbo].[系統設定] (
        [設定編號]      INT IDENTITY(1,1) PRIMARY KEY,
        [設定名稱]      NVARCHAR(100) NOT NULL UNIQUE,
        [設定值]        NVARCHAR(MAX),
        [說明]          NVARCHAR(500),
        [修改時間]      DATETIME DEFAULT GETDATE()
    );
END
GO

-- ========================================
-- 插入預設15個組別
-- ========================================
IF NOT EXISTS (SELECT * FROM [組別設定])
BEGIN
    INSERT INTO [組別設定] ([組別名稱], [組別代碼]) VALUES
    (N'第一組', N'G01'),
    (N'第二組', N'G02'),
    (N'第三組', N'G03'),
    (N'第四組', N'G04'),
    (N'第五組', N'G05'),
    (N'第六組', N'G06'),
    (N'第七組', N'G07'),
    (N'第八組', N'G08'),
    (N'第九組', N'G09'),
    (N'第十組', N'G10'),
    (N'第十一組', N'G11'),
    (N'第十二組', N'G12'),
    (N'第十三組', N'G13'),
    (N'第十四組', N'G14'),
    (N'第十五組', N'G15');
END
GO

-- ========================================
-- 插入預設系統設定
-- ========================================
IF NOT EXISTS (SELECT * FROM [系統設定])
BEGIN
    INSERT INTO [系統設定] ([設定名稱], [設定值], [說明]) VALUES
    (N'儲存根路徑', N'D:\儲存區', N'檔案儲存根目錄'),
    (N'永久區路徑', N'D:\儲存區\永久區', N'永久保存區路徑'),
    (N'時效區路徑', N'D:\儲存區\時效區', N'時效保存區路徑'),
    (N'資源回收桶路徑', N'D:\儲存區\資源回收桶', N'資源回收桶路徑'),
    (N'時效區保存天數', N'30', N'時效區檔案保存天數'),
    (N'最大上傳檔案大小MB', N'500', N'單一檔案最大上傳大小(MB)'),
    (N'系統名稱', N'文件管理系統', N'系統顯示名稱'),
    (N'AD網域', N'', N'Active Directory 網域名稱(移機後設定)'),
    (N'AD啟用', N'false', N'是否啟用AD驗證');
END
GO

-- ========================================
-- 建立索引
-- ========================================
CREATE NONCLUSTERED INDEX IX_操作紀錄_操作時間 ON [操作紀錄]([操作時間] DESC);
CREATE NONCLUSTERED INDEX IX_操作紀錄_IP ON [操作紀錄]([操作者IP]);
CREATE NONCLUSTERED INDEX IX_檔案主檔_組別 ON [檔案主檔]([組別編號]);
CREATE NONCLUSTERED INDEX IX_檔案主檔_儲存區 ON [檔案主檔]([儲存區類型]);
CREATE NONCLUSTERED INDEX IX_資安稽核_時間 ON [資安稽核紀錄]([發生時間] DESC);
GO

PRINT N'資料庫建置完成！';
GO
