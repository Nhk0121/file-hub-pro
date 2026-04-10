using Dapper;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class StorageService
{
    private readonly DbConnectionFactory _db;
    private readonly IConfiguration _config;

    public StorageService(DbConnectionFactory db, IConfiguration config) { _db = db; _config = config; }

    public async Task<List<DepartmentQuotaDto>> GetQuotasAsync()
    {
        using var conn = _db.CreateConnection();
        var quotas = await conn.QueryAsync<DepartmentQuotaDto>("SELECT * FROM StorageQuotas");
        return quotas.ToList();
    }

    public async Task UpdateQuotaAsync(string department, string zone, int quotaMB)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            MERGE StorageQuotas AS target
            USING (VALUES (@Department, @Zone, @QuotaMB)) AS source (Department, Zone, QuotaMB)
            ON target.Department = source.Department AND target.Zone = source.Zone
            WHEN MATCHED THEN UPDATE SET QuotaMB = source.QuotaMB
            WHEN NOT MATCHED THEN INSERT (Department, Zone, QuotaMB) VALUES (source.Department, source.Zone, source.QuotaMB);",
            new { Department = department, Zone = zone, QuotaMB = quotaMB });
    }

    public Task<object> GetDiskUsageAsync()
    {
        var basePath = _config["Storage:BasePath"] ?? @"E:\DMS";
        try
        {
            var drive = new DriveInfo(Path.GetPathRoot(basePath)!);
            return Task.FromResult<object>(new
            {
                totalMB = (int)(drive.TotalSize / 1024 / 1024),
                usedMB = (int)((drive.TotalSize - drive.AvailableFreeSpace) / 1024 / 1024),
                freeMB = (int)(drive.AvailableFreeSpace / 1024 / 1024),
            });
        }
        catch
        {
            return Task.FromResult<object>(new { totalMB = 0, usedMB = 0, freeMB = 0 });
        }
    }
}
