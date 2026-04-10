using Dapper;

namespace TaoyuanDMS.API.Services;

public class SectionService
{
    private readonly DbConnectionFactory _db;

    public SectionService(DbConnectionFactory db) => _db = db;

    public async Task<Dictionary<string, List<string>>> GetAllAsync()
    {
        using var conn = _db.CreateConnection();
        var rows = await conn.QueryAsync<dynamic>("SELECT Department, Section FROM DepartmentSections ORDER BY Department, Section");
        var result = new Dictionary<string, List<string>>();
        foreach (var row in rows)
        {
            var dept = (string)row.Department;
            if (!result.ContainsKey(dept)) result[dept] = new List<string>();
            result[dept].Add((string)row.Section);
        }
        return result;
    }

    public async Task AddAsync(string department, string section)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(
            "IF NOT EXISTS (SELECT 1 FROM DepartmentSections WHERE Department=@Dept AND Section=@Sec) INSERT INTO DepartmentSections (Department, Section) VALUES (@Dept, @Sec)",
            new { Dept = department, Sec = section });
    }

    public async Task RemoveAsync(string department, string section)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM DepartmentSections WHERE Department = @Dept AND Section = @Sec",
            new { Dept = department, Sec = section });
    }
}
