using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace TaoyuanDMS.API.Services;

/// <summary>
/// OnlyOffice Document Server 整合服務
/// - 產生編輯器設定（含 JWT 簽章）
/// - 驗證 callback / download 端點傳回的 JWT
/// </summary>
public class OnlyOfficeService
{
    private readonly IConfiguration _config;

    public OnlyOfficeService(IConfiguration config) { _config = config; }

    public string JwtSecret => _config["OnlyOffice:JwtSecret"]
        ?? throw new InvalidOperationException("未設定 OnlyOffice:JwtSecret");

    /// <summary>瀏覽器載入 DocsAPI 用的公開 URL（通常經 IIS 反向代理）。</summary>
    public string PublicDocumentServerUrl =>
        _config["OnlyOffice:PublicDocumentServerUrl"] ?? "/onlyoffice";

    /// <summary>DocServer 由內網拉檔/回呼 DMS 用的 base URL。</summary>
    public string CallbackBaseUrl => _config["OnlyOffice:CallbackBaseUrl"]
        ?? throw new InvalidOperationException("未設定 OnlyOffice:CallbackBaseUrl");

    /// <summary>支援的 Office 副檔名。</summary>
    public static readonly string[] WordExts = { ".doc", ".docx", ".odt", ".rtf", ".txt" };
    public static readonly string[] CellExts = { ".xls", ".xlsx", ".ods", ".csv" };
    public static readonly string[] SlideExts = { ".ppt", ".pptx", ".odp" };

    public static string? DetectDocumentType(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        if (WordExts.Contains(ext)) return "word";
        if (CellExts.Contains(ext)) return "cell";
        if (SlideExts.Contains(ext)) return "slide";
        return null;
    }

    /// <summary>簽出 JWT（HS256）。payload 內如帶 exp 會自動跳過 expires 參數。</summary>
    public string Sign(object payload)
    {
        var handler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var json = JsonSerializer.Serialize(payload);
        var payloadDict = JsonSerializer.Deserialize<Dictionary<string, object>>(json)!;
        var claims = payloadDict
            .Where(kv => kv.Key != "exp")
            .Select(kv => new Claim(kv.Key, kv.Value?.ToString() ?? string.Empty));
        DateTime? exp = payloadDict.TryGetValue("exp", out var e) && long.TryParse(e?.ToString(), out var ts)
            ? DateTimeOffset.FromUnixTimeSeconds(ts).UtcDateTime
            : DateTime.UtcNow.AddHours(8);
        var token = new JwtSecurityToken(claims: claims, signingCredentials: creds, expires: exp);
        return handler.WriteToken(token);
    }

    /// <summary>驗證並解析 JWT,失敗時拋 SecurityTokenException。</summary>
    public Dictionary<string, JsonElement> Verify(string jwt)
    {
        var handler = new JwtSecurityTokenHandler();
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        handler.ValidateToken(jwt, new TokenValidationParameters
        {
            ValidateIssuer = false,
            ValidateAudience = false,
            ValidateLifetime = false,
            IssuerSigningKey = key,
        }, out var validated);
        var token = (JwtSecurityToken)validated;
        // 將 claims 還原為 JsonElement dict 方便讀取
        var dict = new Dictionary<string, JsonElement>();
        using var doc = JsonDocument.Parse(JsonSerializer.Serialize(
            token.Claims.ToDictionary(c => c.Type, c => (object?)c.Value)));
        foreach (var p in doc.RootElement.EnumerateObject())
            dict[p.Name] = p.Value.Clone();
        return dict;
    }
}
