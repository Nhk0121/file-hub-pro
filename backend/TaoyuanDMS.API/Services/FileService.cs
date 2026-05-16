using Dapper;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class FileService
{
    private readonly DbConnectionFactory _db;
    private readonly IConfiguration _config;
    private readonly StorageService _storage;
    private const string SystemCreatedBy = "system";

    // 固定的兩個分區與 16 個組別（與前端 organization.ts 對應）
    private static readonly string[] Zones = { "永久區", "時效區" };
    private static readonly string[] Departments = {
        "00.處長室","01.維護組","02.設計組","03.業務組","04.電費組","05.調度組",
        "06.總務組","07.會計組","08.人資組","09.政風組","10.工務段","11.工安組",
        "12.電控組","13.電力工會","14.福利會","15.檔案下載"
    };

    public FileService(DbConnectionFactory db, IConfiguration config, StorageService storage)
    {
        _db = db;
        _config = config;
        _storage = storage;
    }

    private async Task<string> GetBasePathAsync()
    {
        try
        {
            var settings = await _storage.GetSettingsAsync();
            if (!string.IsNullOrWhiteSpace(settings?.PrimaryPath)) return settings.PrimaryPath;
        }
        catch { /* 忽略，回退設定檔 */ }
        return _config["Storage:BasePath"] ?? @"E:\DMS";
    }

    // ===== 合成虛擬節點 ID =====
    private static string ZoneId(string zone) => $"z-{Slug(zone, 12)}";
    private static string DeptId(string zone, string dept) => $"d-{Slug(zone, 8)}-{Slug(dept, 8)}";
    private static string SectionId(string zone, string dept, string section) => $"s-{Slug(zone, 8)}-{Slug(dept, 8)}-{Slug(section, 8)}";

    private static string Slug(string value, int length = 12)
    {
        var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(value));
        return Convert.ToHexString(bytes)[..length].ToLowerInvariant();
    }

    private static (string zone, string? dept, string? section)? ParseVirtualId(string? id)
    {
        if (string.IsNullOrEmpty(id)) return null;
        if (id.StartsWith("zone:"))
        {
            var parts = id.Split(':', 2);
            return (parts[1], null, null);
        }
        if (id.StartsWith("dept:"))
        {
            var parts = id.Split(':', 3);
            if (parts.Length == 3) return (parts[1], parts[2], null);
        }
        if (id.StartsWith("section:"))
        {
            var parts = id.Split(':', 4);
            if (parts.Length == 4) return (parts[1], parts[2], parts[3]);
        }
        return null;
    }

    private static (string zone, string? dept, string? section)? ParseStableSystemId(string? id, IEnumerable<(string Department, string Section)> sectionRows)
    {
        if (string.IsNullOrEmpty(id)) return null;
        foreach (var zone in Zones)
        {
            if (id == ZoneId(zone)) return (zone, null, null);
            foreach (var dept in Departments)
            {
                if (id == DeptId(zone, dept)) return (zone, dept, null);
                foreach (var row in sectionRows.Where(r => r.Department == dept))
                {
                    if (id == SectionId(zone, dept, row.Section)) return (zone, dept, row.Section);
                }
            }
        }
        return null;
    }

    // 用記憶體快取避免每次 GET 都重新 UPSERT 47+ 筆系統資料夾
    private static readonly SemaphoreSlim _ensureLock = new(1, 1);
    private static DateTime _lastEnsuredAt = DateTime.MinValue;
    private static int _lastSectionCount = -1;
    private static string? _lastError = null;
    private static long _lastDurationMs = 0;

    public async Task<SystemFolderStatusDto> GetSystemFolderStatusAsync()
    {
        using var conn = _db.CreateConnection();
        var sectionCount = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM DepartmentSections");
        var totalSystemFolders = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(*) FROM Files WHERE IsSystem = 1");
        // 預期數量 = Zones × (1 + Departments × (1 + 該部門課別數))
        // 較精準作法：固定 Zones × Departments + Zones × 1 + Zones × sectionCount
        var expected = Zones.Length * (1 + Departments.Length) + Zones.Length * sectionCount;
        return new SystemFolderStatusDto
        {
            LastEnsuredAt = _lastEnsuredAt == DateTime.MinValue ? null : _lastEnsuredAt,
            CachedSectionCount = _lastSectionCount < 0 ? null : _lastSectionCount,
            CurrentSectionCount = sectionCount,
            TotalSystemFolders = totalSystemFolders,
            ExpectedSystemFolders = expected,
            IsHealthy = totalSystemFolders == expected && _lastError == null,
            LastError = _lastError,
            LastDurationMs = _lastDurationMs,
            BasePath = await GetBasePathAsync(),
        };
    }

    public async Task EnsureSystemFoldersAsync(bool force = false)
    {
        await _ensureLock.WaitAsync();
        var sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using var conn = _db.CreateConnection();
            var sectionRows = (await conn.QueryAsync<(string Department, string Section)>(
                "SELECT Department, Section FROM DepartmentSections ORDER BY Department, Section")).ToList();

            // 5 分鐘內且課別數量未變則跳過
            if (!force
                && _lastSectionCount == sectionRows.Count
                && (DateTime.UtcNow - _lastEnsuredAt).TotalMinutes < 5)
            {
                return;
            }

            var basePath = await GetBasePathAsync();
            var now = DateTime.UtcNow;

            // === 清理：刪除重複的系統名稱資料夾（含 IsSystem=1 但 Id 不在標準清單者） ===
            // 標準系統 Id 集合
            var validSystemIds = new HashSet<string>();
            foreach (var z in Zones)
            {
                validSystemIds.Add(ZoneId(z));
                foreach (var d in Departments)
                {
                    validSystemIds.Add(DeptId(z, d));
                    foreach (var row in sectionRows.Where(r => r.Department == d))
                        validSystemIds.Add(SectionId(z, d, row.Section));
                }
            }

            var systemNames = Zones.Concat(Departments).ToArray();

            // (1) 刪除 IsSystem=0 的同名孤兒（早期測試殘留）
            var dupes = (await conn.QueryAsync<string>(@"
                SELECT Id FROM Files
                WHERE IsSystem = 0
                  AND Type = 'folder'
                  AND Name IN @Names
                  AND NOT EXISTS (SELECT 1 FROM Files c WHERE c.ParentId = Files.Id)",
                new { Names = systemNames })).ToList();
            if (dupes.Count > 0)
            {
                await conn.ExecuteAsync("DELETE FROM Files WHERE Id IN @Ids", new { Ids = dupes });
                Console.WriteLine($"[Cleanup] 刪除 {dupes.Count} 筆 IsSystem=0 重複資料夾");
            }

            // (2) 刪除 IsSystem=1 但 Id 不在標準清單的「殘留系統資料夾」（雜湊/版本變更後遺留）
            //     僅刪除無子內容（避免誤刪含使用者檔案的歷史節點）
            var orphanIdRows = (await conn.QueryAsync<string>(@"
                SELECT Id FROM Files
                WHERE IsSystem = 1
                  AND Name IN @Names
                  AND NOT EXISTS (SELECT 1 FROM Files c WHERE c.ParentId = Files.Id)",
                new { Names = systemNames })).ToList();
            var orphanLegacy = orphanIdRows.Where(id => !validSystemIds.Contains(id)).ToList();
            if (orphanLegacy.Count > 0)
            {
                await conn.ExecuteAsync("DELETE FROM Files WHERE Id IN @Ids", new { Ids = orphanLegacy });
                Console.WriteLine($"[Cleanup] 刪除 {orphanLegacy.Count} 筆 IsSystem=1 孤兒系統資料夾");
            }

            // 先一次撈出所有系統資料夾的 Id,避免逐筆 SELECT
            var existing = (await conn.QueryAsync<string>(
                "SELECT Id FROM Files WHERE IsSystem = 1")).ToHashSet();

            foreach (var zone in Zones)
            {
                await UpsertSystemFolderAsync(conn, existing, ZoneId(zone), zone, null, "zone", Path.Combine(basePath, zone), now);
                foreach (var dept in Departments)
                {
                    await UpsertSystemFolderAsync(conn, existing, DeptId(zone, dept), dept, ZoneId(zone), "department", Path.Combine(basePath, zone, dept), now);
                    foreach (var row in sectionRows.Where(r => r.Department == dept))
                    {
                        await UpsertSystemFolderAsync(conn, existing, SectionId(zone, dept, row.Section), row.Section, DeptId(zone, dept), "section", Path.Combine(basePath, zone, dept, row.Section), now);
                    }
                }
            }

            _lastEnsuredAt = DateTime.UtcNow;
            _lastSectionCount = sectionRows.Count;
            _lastError = null;
        }
        catch (Exception ex)
        {
            _lastError = ex.Message;
            throw;
        }
        finally
        {
            sw.Stop();
            _lastDurationMs = sw.ElapsedMilliseconds;
            _ensureLock.Release();
        }
    }

    private static async Task UpsertSystemFolderAsync(
        System.Data.IDbConnection conn,
        HashSet<string> existing,
        string id, string name, string? parentId, string level, string diskPath, DateTime now)
    {
        try { Directory.CreateDirectory(diskPath); } catch { /* 磁碟錯誤不擋 DB */ }

        if (existing.Contains(id))
        {
            // 已存在：只更新 DiskPath/Name（避免動到 ParentId 觸發外鍵）
            await conn.ExecuteAsync(
                "UPDATE Files SET Name = @Name, FolderLevel = @Level, DiskPath = @DiskPath WHERE Id = @Id AND IsSystem = 1",
                new { Id = id, Name = name, Level = level, DiskPath = diskPath });
        }
        else
        {
            await conn.ExecuteAsync(@"
                INSERT INTO Files (Id, Name, Type, ParentId, IsSystem, FolderLevel, DiskPath, CreatedBy, CreatedAt, UpdatedAt)
                VALUES (@Id, @Name, 'folder', @ParentId, 1, @Level, @DiskPath, @CreatedBy, @Now, @Now)",
                new { Id = id, Name = name, ParentId = parentId, Level = level, DiskPath = diskPath, CreatedBy = SystemCreatedBy, Now = now });
            existing.Add(id);
        }
    }

    private async Task<List<FileDto>> BuildVirtualTreeAsync()
    {
        var basePath = await GetBasePathAsync();
        using var conn = _db.CreateConnection();
        var sectionRows = (await conn.QueryAsync<(string Department, string Section)>(
            "SELECT Department, Section FROM DepartmentSections ORDER BY Department, Section")).ToList();

        var nodes = new List<FileDto>();
        var now = DateTime.UtcNow.ToString("o");

        foreach (var zone in Zones)
        {
            nodes.Add(new FileDto
            {
                Id = ZoneId(zone),
                Name = zone,
                Type = "folder",
                ParentId = null,
                IsSystem = true,
                FolderLevel = "zone",
                DiskPath = Path.Combine(basePath, zone),
                CreatedBy = "system",
                CreatedAt = now,
                UpdatedAt = now,
            });

            foreach (var dept in Departments)
            {
                nodes.Add(new FileDto
                {
                    Id = DeptId(zone, dept),
                    Name = dept,
                    Type = "folder",
                    ParentId = ZoneId(zone),
                    IsSystem = true,
                    FolderLevel = "department",
                    DiskPath = Path.Combine(basePath, zone, dept),
                    CreatedBy = "system",
                    CreatedAt = now,
                    UpdatedAt = now,
                });

                foreach (var (d, sec) in sectionRows.Where(r => r.Department == dept))
                {
                    nodes.Add(new FileDto
                    {
                        Id = SectionId(zone, dept, sec),
                        Name = sec,
                        Type = "folder",
                        ParentId = DeptId(zone, dept),
                        IsSystem = true,
                        FolderLevel = "section",
                        DiskPath = Path.Combine(basePath, zone, dept, sec),
                        CreatedBy = "system",
                        CreatedAt = now,
                        UpdatedAt = now,
                    });
                }
            }
        }
        return nodes;
    }

    public async Task<List<FileDto>> GetAllAsync()
    {
        // 系統資料夾於應用程式啟動時已同步，此處不再每次重跑
        using var conn = _db.CreateConnection();
        return (await conn.QueryAsync<FileDto>("SELECT * FROM Files")).ToList();
    }

    public async Task<List<FileDto>> GetChildrenAsync(string? parentId)
    {
        using var conn = _db.CreateConnection();
        return (await conn.QueryAsync<FileDto>(
            "SELECT * FROM Files WHERE (@ParentId IS NULL AND ParentId IS NULL) OR ParentId = @ParentId",
            new { ParentId = parentId })).ToList();
    }

    public async Task<FileDto> GetByIdAsync(string id)
    {
        // 虛擬節點：直接從合成樹回傳
        if (ParseVirtualId(id) is not null)
        {
            var tree = await BuildVirtualTreeAsync();
            var v = tree.FirstOrDefault(n => n.Id == id);
            if (v != null) return v;
        }

        using var conn = _db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<FileDto>("SELECT * FROM Files WHERE Id = @Id", new { Id = id })
            ?? throw new KeyNotFoundException("檔案不存在");
    }

    public async Task<FileDto> CreateFolderAsync(string name, string? parentId, string createdBy)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("資料夾名稱不可為空");

        using var conn = _db.CreateConnection();

        // 同層唯一性檢查：禁止同層出現相同名稱的資料夾
        await EnsureNameUniqueInParentAsync(conn, parentId, name, "folder", excludeId: null);

        var id = Guid.NewGuid().ToString();
        var now = DateTime.UtcNow;

        // 建立實體目錄
        var diskPath = await BuildDiskPathAsync(parentId, name);
        var diskCreated = false;
        try
        {
            if (!Directory.Exists(diskPath))
            {
                Directory.CreateDirectory(diskPath);
                diskCreated = true;
            }

            await conn.ExecuteAsync(@"
                INSERT INTO Files (Id, Name, Type, ParentId, IsSystem, FolderLevel, DiskPath, CreatedBy, CreatedAt, UpdatedAt)
                VALUES (@Id, @Name, 'folder', @ParentId, 0, 'user', @DiskPath, @CreatedBy, @Now, @Now)",
                new { Id = id, Name = name, ParentId = parentId, DiskPath = diskPath, CreatedBy = createdBy, Now = now });

            return await GetByIdAsync(id);
        }
        catch
        {
            // 補償：DB 失敗則刪除剛建立的實體目錄
            if (diskCreated)
            {
                try { Directory.Delete(diskPath, false); } catch { /* 忽略 */ }
            }
            throw;
        }
    }

    public async Task<FileDto> UploadAsync(IFormFile file, string? parentId, string createdBy)
    {
        if (file == null || file.Length == 0)
            throw new ArgumentException("上傳檔案無效或為空");

        using var conn = _db.CreateConnection();

        // 驗證 parent 存在（若有指定）
        if (!string.IsNullOrEmpty(parentId))
        {
            var parentExists = await conn.ExecuteScalarAsync<int>(
                "SELECT COUNT(1) FROM Files WHERE Id = @Id", new { Id = parentId });
            if (parentExists == 0)
                throw new ArgumentException($"目標資料夾不存在或已被刪除（parentId={parentId}）。請重新整理頁面後再試。");
        }

        var id = Guid.NewGuid().ToString();
        var now = DateTime.UtcNow;

        // 儲存實體檔案
        var diskPath = await BuildDiskPathAsync(parentId, file.FileName);
        var dir = Path.GetDirectoryName(diskPath)!;
        Directory.CreateDirectory(dir);

        var fileWritten = false;
        try
        {
            await using (var stream = new FileStream(diskPath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }
            fileWritten = true;

            // 文字檔讀取內容
            string? content = null;
            if (IsTextFile(file.FileName))
            {
                content = await File.ReadAllTextAsync(diskPath);
            }

            await conn.ExecuteAsync(@"
                INSERT INTO Files (Id, Name, Type, MimeType, Size, ParentId, Content, IsSystem, DiskPath, CreatedBy, CreatedAt, UpdatedAt)
                VALUES (@Id, @Name, 'file', @MimeType, @Size, @ParentId, @Content, 0, @DiskPath, @CreatedBy, @Now, @Now)",
                new { Id = id, Name = file.FileName, MimeType = file.ContentType, Size = file.Length,
                    ParentId = parentId, Content = content, DiskPath = diskPath, CreatedBy = createdBy, Now = now });

            return await GetByIdAsync(id);
        }
        catch (Exception ex)
        {
            // 補償：DB 失敗則刪除剛寫入的實體檔案，避免孤兒檔
            if (fileWritten)
            {
                try { File.Delete(diskPath); } catch { /* 忽略 */ }
            }
            Console.Error.WriteLine($"[Upload Failed] file={file.FileName}, parentId={parentId}, diskPath={diskPath}, err={ex.Message}");
            throw;
        }
    }

    public async Task<FileDto> RenameAsync(string id, string newName)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(
            "UPDATE Files SET Name = @Name, UpdatedAt = GETUTCDATE() WHERE Id = @Id AND IsSystem = 0",
            new { Name = newName, Id = id });
        return await GetByIdAsync(id);
    }

    public async Task<FileDto> UpdateContentAsync(string id, string content)
    {
        using var conn = _db.CreateConnection();
        var file = await GetByIdAsync(id);

        // 同步更新實體檔案
        if (!string.IsNullOrEmpty(file.DiskPath) && File.Exists(file.DiskPath))
        {
            await File.WriteAllTextAsync(file.DiskPath, content);
        }

        await conn.ExecuteAsync(
            "UPDATE Files SET Content = @Content, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { Content = content, Id = id });
        return await GetByIdAsync(id);
    }

    public async Task<(byte[] Data, string FileName, string ContentType)> DownloadAsync(string id)
    {
        var file = await GetByIdAsync(id);
        if (string.IsNullOrEmpty(file.DiskPath) || !File.Exists(file.DiskPath))
            throw new FileNotFoundException("實體檔案不存在");

        var data = await File.ReadAllBytesAsync(file.DiskPath);
        return (data, file.Name, file.MimeType ?? "application/octet-stream");
    }

    /// <summary>
    /// 系統管理員強制刪除指定資料夾（含子內容），用於清除歷史殘留的重複系統資料夾。
    /// </summary>
    public async Task ForceDeleteAsync(string id)
    {
        using var conn = _db.CreateConnection();
        var file = await conn.QueryFirstOrDefaultAsync<FileDto>(
            "SELECT * FROM Files WHERE Id = @Id", new { Id = id })
            ?? throw new KeyNotFoundException("檔案不存在");

        // 刪除實體
        if (!string.IsNullOrEmpty(file.DiskPath))
        {
            try
            {
                if (file.Type == "folder" && Directory.Exists(file.DiskPath))
                    Directory.Delete(file.DiskPath, true);
                else if (File.Exists(file.DiskPath))
                    File.Delete(file.DiskPath);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[ForceDelete] 實體刪除失敗 {file.DiskPath}: {ex.Message}");
            }
        }

        await DeleteChildrenAsync(id);
        await conn.ExecuteAsync("DELETE FROM Files WHERE Id = @Id", new { Id = id });
    }

    public async Task DeleteAsync(string id)
    {
        using var conn = _db.CreateConnection();
        var file = await GetByIdAsync(id);
        if (file.IsSystem) throw new InvalidOperationException("不可刪除系統資料夾");

        // 刪除實體檔案
        if (!string.IsNullOrEmpty(file.DiskPath))
        {
            if (file.Type == "folder" && Directory.Exists(file.DiskPath))
                Directory.Delete(file.DiskPath, true);
            else if (File.Exists(file.DiskPath))
                File.Delete(file.DiskPath);
        }

        // 遞迴刪除子項目
        await DeleteChildrenAsync(id);
        await conn.ExecuteAsync("DELETE FROM Files WHERE Id = @Id", new { Id = id });
    }

    private async Task DeleteChildrenAsync(string parentId)
    {
        using var conn = _db.CreateConnection();
        var children = await conn.QueryAsync<string>("SELECT Id FROM Files WHERE ParentId = @ParentId", new { ParentId = parentId });
        foreach (var childId in children)
        {
            await DeleteChildrenAsync(childId);
            await conn.ExecuteAsync("DELETE FROM Files WHERE Id = @Id", new { Id = childId });
        }
    }

    private async Task<string> BuildDiskPathAsync(string? parentId, string name)
    {
        var basePath = await GetBasePathAsync();
        if (string.IsNullOrEmpty(parentId))
            return Path.Combine(basePath, name);

        // 虛擬節點 parentId（zone:/dept:/section:）→ 推算實體路徑
        var parsed = ParseVirtualId(parentId);
        if (parsed is { } v)
        {
            var p = Path.Combine(basePath, v.zone);
            if (!string.IsNullOrEmpty(v.dept)) p = Path.Combine(p, v.dept);
            if (!string.IsNullOrEmpty(v.section)) p = Path.Combine(p, v.section);
            return Path.Combine(p, name);
        }

        using var pathConn = _db.CreateConnection();
        var sectionRows = (await pathConn.QueryAsync<(string Department, string Section)>(
            "SELECT Department, Section FROM DepartmentSections")).ToList();
        if (ParseStableSystemId(parentId, sectionRows) is { } stable)
        {
            var p = Path.Combine(basePath, stable.zone);
            if (!string.IsNullOrEmpty(stable.dept)) p = Path.Combine(p, stable.dept);
            if (!string.IsNullOrEmpty(stable.section)) p = Path.Combine(p, stable.section);
            return Path.Combine(p, name);
        }

        // 一般 DB 內資料夾
        using var conn = _db.CreateConnection();
        var parent = await conn.QueryFirstOrDefaultAsync<FileDto>("SELECT * FROM Files WHERE Id = @Id", new { Id = parentId });
        if (parent?.DiskPath != null)
            return Path.Combine(parent.DiskPath, name);

        return Path.Combine(basePath, name);
    }

    private static bool IsTextFile(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".txt" or ".md" or ".markdown" or ".html" or ".htm" or ".csv" or ".json" or ".xml" or ".log" or ".ini" or ".yaml" or ".yml";
    }
}
