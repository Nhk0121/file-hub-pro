using Dapper;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class FileService
{
    private readonly DbConnectionFactory _db;
    private readonly IConfiguration _config;

    public FileService(DbConnectionFactory db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    private string BasePath => _config["Storage:BasePath"] ?? @"E:\DMS";

    public async Task<List<FileDto>> GetAllAsync()
    {
        using var conn = _db.CreateConnection();
        var files = await conn.QueryAsync<FileDto>("SELECT * FROM Files");
        return files.ToList();
    }

    public async Task<List<FileDto>> GetChildrenAsync(string? parentId)
    {
        using var conn = _db.CreateConnection();
        var files = string.IsNullOrEmpty(parentId)
            ? await conn.QueryAsync<FileDto>("SELECT * FROM Files WHERE ParentId IS NULL")
            : await conn.QueryAsync<FileDto>("SELECT * FROM Files WHERE ParentId = @ParentId", new { ParentId = parentId });
        return files.ToList();
    }

    public async Task<FileDto> GetByIdAsync(string id)
    {
        using var conn = _db.CreateConnection();
        return await conn.QueryFirstOrDefaultAsync<FileDto>("SELECT * FROM Files WHERE Id = @Id", new { Id = id })
            ?? throw new Exception("檔案不存在");
    }

    public async Task<FileDto> CreateFolderAsync(string name, string? parentId, string createdBy)
    {
        using var conn = _db.CreateConnection();
        var id = Guid.NewGuid().ToString();
        var now = DateTime.UtcNow;

        // 建立實體目錄
        var diskPath = await BuildDiskPathAsync(parentId, name);
        Directory.CreateDirectory(diskPath);

        await conn.ExecuteAsync(@"
            INSERT INTO Files (Id, Name, Type, ParentId, DiskPath, CreatedBy, CreatedAt, UpdatedAt)
            VALUES (@Id, @Name, 'folder', @ParentId, @DiskPath, @CreatedBy, @Now, @Now)",
            new { Id = id, Name = name, ParentId = parentId, DiskPath = diskPath, CreatedBy = createdBy, Now = now });

        return await GetByIdAsync(id);
    }

    public async Task<FileDto> UploadAsync(IFormFile file, string? parentId, string createdBy)
    {
        using var conn = _db.CreateConnection();
        var id = Guid.NewGuid().ToString();
        var now = DateTime.UtcNow;

        // 儲存實體檔案
        var diskPath = await BuildDiskPathAsync(parentId, file.FileName);
        var dir = Path.GetDirectoryName(diskPath)!;
        Directory.CreateDirectory(dir);

        await using var stream = new FileStream(diskPath, FileMode.Create);
        await file.CopyToAsync(stream);

        // 文字檔讀取內容
        string? content = null;
        if (IsTextFile(file.FileName))
        {
            stream.Position = 0;
            using var reader = new StreamReader(stream);
            content = await reader.ReadToEndAsync();
        }

        await conn.ExecuteAsync(@"
            INSERT INTO Files (Id, Name, Type, MimeType, Size, ParentId, Content, DiskPath, CreatedBy, CreatedAt, UpdatedAt)
            VALUES (@Id, @Name, 'file', @MimeType, @Size, @ParentId, @Content, @DiskPath, @CreatedBy, @Now, @Now)",
            new { Id = id, Name = file.FileName, MimeType = file.ContentType, Size = file.Length,
                ParentId = parentId, Content = content, DiskPath = diskPath, CreatedBy = createdBy, Now = now });

        return await GetByIdAsync(id);
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
        if (string.IsNullOrEmpty(parentId))
            return Path.Combine(BasePath, name);

        using var conn = _db.CreateConnection();
        var parent = await conn.QueryFirstOrDefaultAsync<FileDto>("SELECT * FROM Files WHERE Id = @Id", new { Id = parentId });
        if (parent?.DiskPath != null)
            return Path.Combine(parent.DiskPath, name);

        return Path.Combine(BasePath, name);
    }

    private static bool IsTextFile(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext is ".txt" or ".md" or ".markdown" or ".html" or ".htm" or ".csv" or ".json" or ".xml" or ".log" or ".ini" or ".yaml" or ".yml";
    }
}
