using Dapper;
using System.Text.Json;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class PermissionService
{
    private readonly DbConnectionFactory _db;

    public PermissionService(DbConnectionFactory db) => _db = db;

    public async Task<List<FolderPermissionDto>> GetRulesAsync()
    {
        using var conn = _db.CreateConnection();
        var rules = await conn.QueryAsync<FolderPermissionDto>("SELECT * FROM FolderPermissions");
        return rules.ToList();
    }

    public async Task SetPermissionAsync(string folderId, string userId, string permission)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            MERGE FolderPermissions AS target
            USING (VALUES (@FolderId, @UserId, @Permission)) AS source (FolderId, UserId, Permission)
            ON target.FolderId = source.FolderId AND target.UserId = source.UserId
            WHEN MATCHED THEN UPDATE SET Permission = source.Permission
            WHEN NOT MATCHED THEN INSERT (FolderId, UserId, Permission) VALUES (source.FolderId, source.UserId, source.Permission);",
            new { FolderId = folderId, UserId = userId, Permission = permission });
    }

    public async Task RemoveRuleAsync(string ruleId)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM FolderPermissions WHERE Id = @Id", new { Id = ruleId });
    }

    public async Task<List<PermanentZoneOverrideDto>> GetOverridesAsync()
    {
        using var conn = _db.CreateConnection();
        var overrides = await conn.QueryAsync<dynamic>("SELECT * FROM PermanentZoneOverrides");
        return overrides.Select(o => new PermanentZoneOverrideDto
        {
            Id = o.Id,
            UserId = o.UserId,
            Departments = JsonSerializer.Deserialize<string[]>((string)o.Departments) ?? Array.Empty<string>()
        }).ToList();
    }

    public async Task SetOverrideAsync(string userId, string[] departments)
    {
        using var conn = _db.CreateConnection();
        var json = JsonSerializer.Serialize(departments);
        var existing = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT Id FROM PermanentZoneOverrides WHERE UserId = @UserId", new { UserId = userId });

        if (existing != null)
            await conn.ExecuteAsync("UPDATE PermanentZoneOverrides SET Departments = @Depts WHERE UserId = @UserId",
                new { Depts = json, UserId = userId });
        else
            await conn.ExecuteAsync("INSERT INTO PermanentZoneOverrides (UserId, Departments) VALUES (@UserId, @Depts)",
                new { UserId = userId, Depts = json });
    }

    public async Task RemoveOverrideAsync(string overrideId)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM PermanentZoneOverrides WHERE Id = @Id", new { Id = overrideId });
    }
}
