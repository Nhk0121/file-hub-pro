using Dapper;
using System.Text.Json;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class TrashService
{
    private readonly DbConnectionFactory _db;

    public TrashService(DbConnectionFactory db) => _db = db;

    public async Task<List<TrashItemDto>> GetAllAsync()
    {
        using var conn = _db.CreateConnection();
        var items = await conn.QueryAsync<dynamic>("SELECT * FROM TrashItems ORDER BY DeletedAt DESC");
        return items.Select(t => new TrashItemDto
        {
            Item = JsonSerializer.Deserialize<FileDto>((string)t.FileData) ?? new FileDto(),
            DeletedAt = ((DateTime)t.DeletedAt).ToString("o"),
            DeletedBy = (string)t.DeletedBy,
            OriginalParentId = (string?)t.OriginalParentId,
        }).ToList();
    }

    public async Task MoveToTrashAsync(string fileId, string userName)
    {
        using var conn = _db.CreateConnection();
        var file = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM Files WHERE Id = @Id AND IsSystem = 0", new { Id = fileId });
        if (file == null) throw new Exception("檔案不存在或為系統資料夾");

        var fileDto = new FileDto
        {
            Id = file.Id, Name = file.Name, Type = file.Type, MimeType = file.MimeType,
            Size = file.Size, ParentId = file.ParentId, Content = file.Content,
            IsSystem = file.IsSystem, FolderLevel = file.FolderLevel, DiskPath = file.DiskPath,
            CreatedBy = file.CreatedBy, CreatedAt = ((DateTime)file.CreatedAt).ToString("o"),
            UpdatedAt = ((DateTime)file.UpdatedAt).ToString("o"),
        };

        await conn.ExecuteAsync(@"
            INSERT INTO TrashItems (FileId, FileName, FileType, FileData, OriginalParentId, DeletedBy)
            VALUES (@FileId, @FileName, @FileType, @FileData, @OriginalParentId, @DeletedBy)",
            new { FileId = file.Id, FileName = (string)file.Name, FileType = (string)file.Type,
                FileData = JsonSerializer.Serialize(fileDto), OriginalParentId = (string?)file.ParentId, DeletedBy = userName });

        await conn.ExecuteAsync("DELETE FROM Files WHERE Id = @Id", new { Id = fileId });
    }

    public async Task RestoreAsync(string itemId)
    {
        using var conn = _db.CreateConnection();
        var trash = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM TrashItems WHERE FileId = @Id", new { Id = itemId });
        if (trash == null) throw new Exception("回收桶項目不存在");

        var fileDto = JsonSerializer.Deserialize<FileDto>((string)trash.FileData)!;
        await conn.ExecuteAsync(@"
            INSERT INTO Files (Id, Name, Type, MimeType, Size, ParentId, Content, IsSystem, FolderLevel, DiskPath, CreatedBy, CreatedAt, UpdatedAt)
            VALUES (@Id, @Name, @Type, @MimeType, @Size, @ParentId, @Content, @IsSystem, @FolderLevel, @DiskPath, @CreatedBy, @CreatedAt, GETUTCDATE())",
            fileDto);

        await conn.ExecuteAsync("DELETE FROM TrashItems WHERE FileId = @Id", new { Id = itemId });
    }

    public async Task PermanentDeleteAsync(string itemId)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM TrashItems WHERE FileId = @Id", new { Id = itemId });
    }

    public async Task EmptyTrashAsync()
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM TrashItems");
    }
}
