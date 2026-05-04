using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using Microsoft.IdentityModel.Tokens;

namespace TaoyuanDMS.API.Services;

/// <summary>
/// OnlyOffice 整合服務：
/// - 簽發 / 驗證 OnlyOffice 規格的 JWT（HS256）
/// - 提供 callback 處理（status=2 / 6 時把 OnlyOffice 編輯後的檔案抓回 DMS-VM 寫回原檔）
/// 設計原則：與 DMS 既有 JWT (Auth) 完全分開，避免污染 ASP.NET Core 預設驗證鏈。
/// </summary>
public class OnlyOfficeService
{
    private readonly IConfiguration _config;
    private readonly FileService _files;
    private readonly EditLockService _locks;
    private readonly HttpClient _http;

    public OnlyOfficeService(IConfiguration config, FileService files, EditLockService locks, IHttpClientFactory httpFactory)
    {
        _config = config;
        _files = files;
        _locks = locks;
        _http = httpFactory.CreateClient("OnlyOffice");
    }

    public string DocumentServerUrl =>
        (_config["OnlyOffice:DocumentServerUrl"] ?? "").TrimEnd('/');

    public string CallbackBaseUrl =>
        (_config["OnlyOffice:CallbackBaseUrl"] ?? "").TrimEnd('/');

    public string JwtSecret =>
        _config["OnlyOffice:JwtSecret"] ?? "";

    public bool JwtEnabled => !string.IsNullOrWhiteSpace(JwtSecret);

    /// <summary>
    /// 依 payload 產生 OnlyOffice JWT（內含 document/editorConfig 的 hash）
    /// payload: 一般傳入序列化後的 config 物件
    /// </summary>
    public string SignToken(object payload)
    {
        if (!JwtEnabled) return "";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        // OnlyOffice 接受任意 claim，把整個 payload 攤平
        var json = JsonSerializer.Serialize(payload);
        var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(json) ?? new();

        var handler = new JwtSecurityTokenHandler();
        var token = new JwtSecurityToken(
            claims: dict.Select(kv => new Claim(kv.Key, kv.Value?.ToString() ?? "", ClaimValueTypes.String)),
            signingCredentials: creds);
        return handler.WriteToken(token);
    }

    /// <summary>
    /// 驗證 OnlyOffice callback 帶回的 JWT。
    /// OnlyOffice 把 token 放在 body.token 或 Authorization header (Bearer ...)。
    /// </summary>
    public bool TryValidateToken(string token, out JwtSecurityToken? parsed)
    {
        parsed = null;
        if (!JwtEnabled) return true; // 未啟用驗證 → 一律通過
        try
        {
            var handler = new JwtSecurityTokenHandler();
            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(JwtSecret));
            handler.ValidateToken(token, new TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ClockSkew = TimeSpan.FromMinutes(5),
            }, out var validated);
            parsed = (JwtSecurityToken)validated;
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// 處理 OnlyOffice 回呼。
    /// 規格：https://api.onlyoffice.com/editors/callback
    /// status: 1=正在編輯, 2=就緒可下載, 3=儲存失敗, 4=關閉未變更, 6=強制儲存可下載, 7=強制儲存失敗
    /// </summary>
    public async Task<object> HandleCallbackAsync(string fileId, OnlyOfficeCallback body)
    {
        // 2 / 6：OnlyOffice 已產出新版本，下載並覆蓋原檔
        if ((body.Status == 2 || body.Status == 6) && !string.IsNullOrWhiteSpace(body.Url))
        {
            try
            {
                using var resp = await _http.GetAsync(body.Url);
                resp.EnsureSuccessStatusCode();
                var bytes = await resp.Content.ReadAsByteArrayAsync();
                await _files.OverwriteFileBytesAsync(fileId, bytes);

                // 編輯結束 → 釋放編輯鎖（OnlyOffice 已關閉）
                if (body.Users != null && body.Users.Length > 0)
                {
                    foreach (var uid in body.Users)
                        await _locks.ReleaseAsync(fileId, uid);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[OnlyOffice Callback] 下載/寫回失敗 fileId={fileId}: {ex.Message}");
                return new { error = 1 };
            }
        }

        // 4：使用者離開且未變更 → 也釋放鎖
        if (body.Status == 4 && body.Users != null)
        {
            foreach (var uid in body.Users)
                await _locks.ReleaseAsync(fileId, uid);
        }

        return new { error = 0 };
    }
}

/// <summary>OnlyOffice callback 規格 body</summary>
public class OnlyOfficeCallback
{
    public string? Key { get; set; }
    public int Status { get; set; }
    public string? Url { get; set; }
    public string[]? Users { get; set; }
    public string? Token { get; set; }
}
