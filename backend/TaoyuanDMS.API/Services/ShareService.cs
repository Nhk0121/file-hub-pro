using Dapper;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class ShareService
{
    private readonly DbConnectionFactory _db;
    private readonly FileService _files;

    public ShareService(DbConnectionFactory db, FileService files)
    {
        _db = db;
        _files = files;
    }

    private static string GenerateToken()
    {
        // 32 bytes -> 43 字元 base64url（無 padding）
        var bytes = new byte[24];
        System.Security.Cryptography.RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public async Task<FileShareDto> CreateAsync(string fileId, string createdBy, string createdByName)
    {
        // 驗證檔案存在且為一般檔案（非資料夾）
        var file = await _files.GetByIdAsync(fileId);
        if (file.Type != "file")
            throw new ArgumentException("僅能對檔案建立分享連結，無法分享資料夾");

        using var conn = _db.CreateConnection();
        var token = GenerateToken();
        var now = DateTime.UtcNow;
        await conn.ExecuteAsync(@"
            INSERT INTO FileShares (Token, FileId, CreatedBy, CreatedByName, CreatedAt, Revoked, DownloadCount)
            VALUES (@Token, @FileId, @CreatedBy, @CreatedByName, @Now, 0, 0)",
            new { Token = token, FileId = fileId, CreatedBy = createdBy, CreatedByName = createdByName, Now = now });

        return new FileShareDto
        {
            Token = token,
            FileId = fileId,
            FileName = file.Name,
            CreatedBy = createdBy,
            CreatedByName = createdByName,
            CreatedAt = now.ToString("o"),
            Revoked = false,
            DownloadCount = 0,
        };
    }

    public async Task<List<FileShareDto>> ListAsync(string? userId = null)
    {
        using var conn = _db.CreateConnection();
        var sql = @"
            SELECT s.Token, s.FileId, f.Name AS FileName, s.CreatedBy, s.CreatedByName,
                   s.CreatedAt, s.Revoked, s.DownloadCount
            FROM FileShares s
            LEFT JOIN Files f ON f.Id = s.FileId
            " + (userId != null ? "WHERE s.CreatedBy = @UserId " : "") + @"
            ORDER BY s.CreatedAt DESC";
        var rows = await conn.QueryAsync<FileShareDto>(sql, new { UserId = userId });
        return rows.ToList();
    }

    public async Task RevokeAsync(string token, string requesterId, bool isAdmin)
    {
        using var conn = _db.CreateConnection();
        var owner = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT CreatedBy FROM FileShares WHERE Token = @Token", new { Token = token });
        if (owner == null) throw new KeyNotFoundException("分享連結不存在");
        if (!isAdmin && owner != requesterId) throw new UnauthorizedAccessException("您只能撤銷自己建立的分享連結");

        await conn.ExecuteAsync("UPDATE FileShares SET Revoked = 1 WHERE Token = @Token", new { Token = token });
    }

    /// <summary>
    /// 公開取得分享檔案內容；不需要登入。
    /// </summary>
    public async Task<(byte[] Data, string FileName, string ContentType)> DownloadByTokenAsync(string token)
    {
        using var conn = _db.CreateConnection();
        var row = await conn.QueryFirstOrDefaultAsync<(string FileId, bool Revoked)>(
            "SELECT FileId, Revoked FROM FileShares WHERE Token = @Token", new { Token = token });
        if (row.FileId == null) throw new KeyNotFoundException("分享連結無效");
        if (row.Revoked) throw new UnauthorizedAccessException("此分享連結已撤銷");

        await conn.ExecuteAsync(
            "UPDATE FileShares SET DownloadCount = DownloadCount + 1 WHERE Token = @Token",
            new { Token = token });

        return await _files.DownloadAsync(row.FileId);
    }

    /// <summary>
    /// 公開取得分享檔案的基本資訊（檔名、大小），供下載頁面顯示。
    /// </summary>
    public async Task<PublicShareInfoDto> GetPublicInfoAsync(string token)
    {
        using var conn = _db.CreateConnection();
        var row = await conn.QueryFirstOrDefaultAsync<(string FileId, bool Revoked, string CreatedByName, DateTime CreatedAt)>(
            "SELECT FileId, Revoked, CreatedByName, CreatedAt FROM FileShares WHERE Token = @Token",
            new { Token = token });
        if (row.FileId == null) throw new KeyNotFoundException("分享連結無效");
        if (row.Revoked) throw new UnauthorizedAccessException("此分享連結已撤銷");

        var file = await _files.GetByIdAsync(row.FileId);
        return new PublicShareInfoDto
        {
            FileName = file.Name,
            Size = file.Size ?? 0,
            MimeType = file.MimeType ?? "application/octet-stream",
            SharedBy = row.CreatedByName,
            SharedAt = row.CreatedAt.ToString("o"),
        };
    }
}
