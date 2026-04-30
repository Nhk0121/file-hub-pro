using Dapper;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class StorageService
{
    private readonly DbConnectionFactory _db;
    private readonly IConfiguration _config;
    private readonly SectionService _sections;

    public StorageService(DbConnectionFactory db, IConfiguration config, SectionService sections)
    {
        _db = db;
        _config = config;
        _sections = sections;
    }

    // ===== 配額 =====
    public async Task<List<DepartmentQuotaDto>> GetQuotasAsync()
    {
        using var conn = _db.CreateConnection();
        var quotas = await conn.QueryAsync<DepartmentQuotaDto>(
            "SELECT Department, Zone, QuotaMB, UsedMB FROM DepartmentQuotas ORDER BY Zone, Department");
        return quotas.ToList();
    }

    public async Task UpdateQuotaAsync(string department, string zone, int quotaMB)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            MERGE DepartmentQuotas AS target
            USING (VALUES (@Department, @Zone, @QuotaMB)) AS source (Department, Zone, QuotaMB)
            ON target.Department = source.Department AND target.Zone = source.Zone
            WHEN MATCHED THEN UPDATE SET QuotaMB = source.QuotaMB
            WHEN NOT MATCHED THEN INSERT (Department, Zone, QuotaMB) VALUES (source.Department, source.Zone, source.QuotaMB);",
            new { Department = department, Zone = zone, QuotaMB = quotaMB });
    }

    // ===== 磁碟使用量 =====
    public async Task<object> GetDiskUsageAsync()
    {
        var settings = await GetSettingsAsync();
        try
        {
            var drive = new DriveInfo(Path.GetPathRoot(settings.PrimaryPath)!);
            return new
            {
                totalMB = (long)(drive.TotalSize / 1024 / 1024),
                usedMB = (long)((drive.TotalSize - drive.AvailableFreeSpace) / 1024 / 1024),
                freeMB = (long)(drive.AvailableFreeSpace / 1024 / 1024),
            };
        }
        catch
        {
            return new { totalMB = 0L, usedMB = 0L, freeMB = 0L };
        }
    }

    // ===== 系統設定 =====
    public async Task<StorageSettingsDto> GetSettingsAsync()
    {
        using var conn = _db.CreateConnection();

        // 容錯：若舊資料庫尚未升級新欄位，自動補上（冪等）
        await conn.ExecuteAsync(@"
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StorageSettings]') AND name = 'TrashRetentionDays')
                ALTER TABLE [dbo].[StorageSettings] ADD [TrashRetentionDays] INT NOT NULL DEFAULT 30;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StorageSettings]') AND name = 'TempZoneRetentionDays')
                ALTER TABLE [dbo].[StorageSettings] ADD [TempZoneRetentionDays] INT NOT NULL DEFAULT 30;
            IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[StorageSettings]') AND name = 'SystemTitle')
                ALTER TABLE [dbo].[StorageSettings] ADD [SystemTitle] NVARCHAR(100) NOT NULL DEFAULT N'桃園區處文件管理系統';");

        var row = await conn.QueryFirstOrDefaultAsync<StorageSettingsDto>(@"
            SELECT TOP 1
                PrimaryPath, AutoCreateFolders, BackupEnabled,
                BackupFrequency, BackupTime, BackupRetentionDays,
                ISNULL(TrashRetentionDays, 30) AS TrashRetentionDays,
                ISNULL(TempZoneRetentionDays, 30) AS TempZoneRetentionDays,
                ISNULL(NULLIF(LTRIM(RTRIM(SystemTitle)), ''), N'桃園區處文件管理系統') AS SystemTitle,
                CONVERT(varchar(33), UpdatedAt, 126) AS UpdatedAt
            FROM StorageSettings WHERE Id = 1");

        if (row == null)
        {
            // 第一次啟用：以 appsettings 的 BasePath 為預設值
            var basePath = _config["Storage:BasePath"] ?? @"E:\DMS";
            await conn.ExecuteAsync(
                "INSERT INTO StorageSettings (Id, PrimaryPath) VALUES (1, @PrimaryPath)",
                new { PrimaryPath = basePath });
            return new StorageSettingsDto
            {
                PrimaryPath = basePath,
                AutoCreateFolders = true,
                BackupEnabled = false,
                BackupFrequency = "每日",
                BackupTime = "02:00",
                BackupRetentionDays = 30,
                TrashRetentionDays = 30,
                TempZoneRetentionDays = 30,
                SystemTitle = "桃園區處文件管理系統",
                UpdatedAt = DateTime.UtcNow.ToString("o"),
            };
        }
        return row;
    }

    public async Task UpdateSettingsAsync(UpdateStorageSettingsRequest req)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE StorageSettings SET
                PrimaryPath = @PrimaryPath,
                AutoCreateFolders = @AutoCreateFolders,
                BackupEnabled = @BackupEnabled,
                BackupFrequency = @BackupFrequency,
                BackupTime = @BackupTime,
                BackupRetentionDays = @BackupRetentionDays,
                TrashRetentionDays = @TrashRetentionDays,
                TempZoneRetentionDays = @TempZoneRetentionDays,
                SystemTitle = ISNULL(NULLIF(LTRIM(RTRIM(@SystemTitle)), ''), N'桃園區處文件管理系統'),
                UpdatedAt = GETUTCDATE()
            WHERE Id = 1",
            req);
    }

    // ===== 備份磁碟 =====
    public async Task<List<BackupDiskDto>> GetDisksAsync()
    {
        using var conn = _db.CreateConnection();
        var disks = await conn.QueryAsync<BackupDiskDto>(@"
            SELECT
                Id, Label, Path, Enabled,
                CONVERT(varchar(33), CreatedAt, 126) AS CreatedAt,
                CONVERT(varchar(33), LastSyncAt, 126) AS LastSyncAt
            FROM BackupDisks ORDER BY CreatedAt");
        return disks.ToList();
    }

    public async Task<BackupDiskDto> AddDiskAsync(CreateBackupDiskRequest req)
    {
        using var conn = _db.CreateConnection();
        var id = Guid.NewGuid().ToString();
        await conn.ExecuteAsync(
            "INSERT INTO BackupDisks (Id, Label, Path) VALUES (@Id, @Label, @Path)",
            new { Id = id, req.Label, req.Path });
        return (await GetDisksAsync()).First(d => d.Id == id);
    }

    public async Task UpdateDiskAsync(string id, UpdateBackupDiskRequest req)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE BackupDisks SET
                Label = COALESCE(@Label, Label),
                Path = COALESCE(@Path, Path),
                Enabled = COALESCE(@Enabled, Enabled)
            WHERE Id = @Id",
            new { Id = id, req.Label, req.Path, req.Enabled });
    }

    public async Task RemoveDiskAsync(string id)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM BackupDisks WHERE Id = @Id", new { Id = id });
    }

    // ===== 移機自動建立資料夾 =====
    /// <summary>
    /// 在主要儲存路徑下建立完整的「永久區/時效區 + 各組別 + 各課別」實體目錄結構。
    /// 已存在的資料夾會被略過，回傳建立統計與錯誤清單。
    /// </summary>
    public async Task<InitializeFoldersResultDto> InitializeFoldersAsync()
    {
        var settings = await GetSettingsAsync();
        var basePath = settings.PrimaryPath;
        var sectionMap = await _sections.GetAllAsync();

        var result = new InitializeFoldersResultDto();
        var zones = new[] { "永久區", "時效區" };

        // 取得所有組別（從配額表取得，避免依賴前端設定）
        using var conn = _db.CreateConnection();
        var departments = (await conn.QueryAsync<string>(
            "SELECT DISTINCT Department FROM DepartmentQuotas ORDER BY Department")).ToList();

        try
        {
            Directory.CreateDirectory(basePath);
        }
        catch (Exception ex)
        {
            result.Errors.Add($"無法建立主要路徑 {basePath}: {ex.Message}");
            return result;
        }

        foreach (var zone in zones)
        {
            foreach (var dept in departments)
            {
                var deptPath = Path.Combine(basePath, zone, dept);
                TryCreate(deptPath, result);

                if (sectionMap.TryGetValue(dept, out var sections))
                {
                    foreach (var sec in sections)
                    {
                        var secPath = Path.Combine(deptPath, sec);
                        TryCreate(secPath, result);
                    }
                }
            }
        }

        // 同步建立到所有啟用的備份磁碟
        var disks = await GetDisksAsync();
        foreach (var disk in disks.Where(d => d.Enabled))
        {
            try { Directory.CreateDirectory(disk.Path); }
            catch (Exception ex) { result.Errors.Add($"備份磁碟 {disk.Label}: {ex.Message}"); continue; }

            foreach (var zone in zones)
                foreach (var dept in departments)
                {
                    var deptPath = Path.Combine(disk.Path, zone, dept);
                    TryCreate(deptPath, result);
                    if (sectionMap.TryGetValue(dept, out var sections))
                        foreach (var sec in sections)
                            TryCreate(Path.Combine(deptPath, sec), result);
                }
        }

        return result;
    }

    // ===== 新增/刪除單一課別資料夾（在主磁碟 + 所有啟用的備份磁碟上同步執行） =====
    /// <summary>
    /// 在主要磁碟與所有啟用備份磁碟的「永久區、時效區」下，建立指定組別/課別資料夾。
    /// </summary>
    public async Task<InitializeFoldersResultDto> CreateSectionFoldersAsync(string department, string section)
    {
        var settings = await GetSettingsAsync();
        var disks = await GetDisksAsync();
        var result = new InitializeFoldersResultDto();
        var roots = new List<string> { settings.PrimaryPath };
        roots.AddRange(disks.Where(d => d.Enabled).Select(d => d.Path));

        foreach (var root in roots)
        {
            foreach (var zone in new[] { "永久區", "時效區" })
            {
                var path = Path.Combine(root, zone, department, section);
                TryCreate(path, result);
            }
        }
        return result;
    }

    /// <summary>
    /// 移除主磁碟與所有啟用備份磁碟上的指定課別資料夾（資料夾若有檔案則略過，避免誤刪）。
    /// </summary>
    public async Task<InitializeFoldersResultDto> RemoveSectionFoldersAsync(string department, string section)
    {
        var settings = await GetSettingsAsync();
        var disks = await GetDisksAsync();
        var result = new InitializeFoldersResultDto();
        var roots = new List<string> { settings.PrimaryPath };
        roots.AddRange(disks.Where(d => d.Enabled).Select(d => d.Path));

        foreach (var root in roots)
        {
            foreach (var zone in new[] { "永久區", "時效區" })
            {
                var path = Path.Combine(root, zone, department, section);
                try
                {
                    if (!Directory.Exists(path)) { result.Skipped++; continue; }
                    // 安全檢查：資料夾內若仍有檔案/子資料夾則不刪除
                    if (Directory.EnumerateFileSystemEntries(path).Any())
                    {
                        result.Errors.Add($"略過刪除（資料夾不為空）：{path}");
                        continue;
                    }
                    Directory.Delete(path);
                    result.Created++; // 借用欄位代表「已處理」
                    result.Paths.Add(path);
                }
                catch (Exception ex)
                {
                    result.Errors.Add($"{path}: {ex.Message}");
                }
            }
        }
        return result;
    }

    private static void TryCreate(string path, InitializeFoldersResultDto result)
    {
        try
        {
            if (Directory.Exists(path)) { result.Skipped++; }
            else { Directory.CreateDirectory(path); result.Created++; result.Paths.Add(path); }
        }
        catch (Exception ex)
        {
            result.Errors.Add($"{path}: {ex.Message}");
        }
    }
}
