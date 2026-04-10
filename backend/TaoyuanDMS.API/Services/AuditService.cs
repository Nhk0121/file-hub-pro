using Dapper;
using System.Text;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class AuditService
{
    private readonly DbConnectionFactory _db;

    public AuditService(DbConnectionFactory db) => _db = db;

    public async Task<List<AuditLogDto>> GetAllAsync(int page = 1, int pageSize = 100)
    {
        using var conn = _db.CreateConnection();
        var offset = (page - 1) * pageSize;
        var logs = await conn.QueryAsync<AuditLogDto>(
            "SELECT * FROM AuditLogs ORDER BY Timestamp DESC OFFSET @Offset ROWS FETCH NEXT @PageSize ROWS ONLY",
            new { Offset = offset, PageSize = pageSize });
        return logs.ToList();
    }

    public async Task AddAsync(CreateAuditLogRequest req, string? ipAddress)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            INSERT INTO AuditLogs (UserId, UserName, Action, TargetName, TargetId, Details, IpAddress)
            VALUES (@UserId, @UserName, @Action, @TargetName, @TargetId, @Details, @IpAddress)",
            new { req.UserId, req.UserName, req.Action, req.TargetName, req.TargetId, req.Details, IpAddress = ipAddress });
    }

    public async Task ClearAsync()
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM AuditLogs");
    }

    public async Task<byte[]> ExportCsvAsync()
    {
        using var conn = _db.CreateConnection();
        var logs = await conn.QueryAsync<AuditLogDto>("SELECT * FROM AuditLogs ORDER BY Timestamp DESC");

        var sb = new StringBuilder();
        sb.AppendLine("時間,使用者ID,使用者名稱,動作,目標名稱,目標ID,詳細,IP位址");
        foreach (var log in logs)
        {
            sb.AppendLine($"\"{log.Timestamp}\",\"{log.UserId}\",\"{log.UserName}\",\"{log.Action}\",\"{log.TargetName}\",\"{log.TargetId}\",\"{log.Details}\",\"{log.IpAddress}\"");
        }
        return Encoding.UTF8.GetPreamble().Concat(Encoding.UTF8.GetBytes(sb.ToString())).ToArray();
    }
}
