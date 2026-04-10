using Dapper;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class EditLockService
{
    private readonly DbConnectionFactory _db;

    public EditLockService(DbConnectionFactory db) => _db = db;

    public async Task<List<EditLockDto>> GetAllAsync()
    {
        using var conn = _db.CreateConnection();
        var locks = await conn.QueryAsync<EditLockDto>("SELECT * FROM EditLocks");
        return locks.ToList();
    }

    public async Task<(bool Success, EditLockDto? Lock)> AcquireAsync(string fileId, string userId, string userName)
    {
        using var conn = _db.CreateConnection();
        var existing = await conn.QueryFirstOrDefaultAsync<EditLockDto>(
            "SELECT * FROM EditLocks WHERE FileId = @FileId", new { FileId = fileId });

        if (existing != null)
        {
            if (existing.UserId == userId) return (true, existing);
            return (false, existing);
        }

        var lockDto = new EditLockDto { FileId = fileId, UserId = userId, UserName = userName, LockedAt = DateTime.UtcNow.ToString("o") };
        await conn.ExecuteAsync(
            "INSERT INTO EditLocks (FileId, UserId, UserName) VALUES (@FileId, @UserId, @UserName)",
            new { FileId = fileId, UserId = userId, UserName = userName });

        return (true, lockDto);
    }

    public async Task ReleaseAsync(string fileId, string userId)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM EditLocks WHERE FileId = @FileId AND UserId = @UserId",
            new { FileId = fileId, UserId = userId });
    }
}
