using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

/// <summary>
/// OnlyOffice 整合端點：
/// GET  /api/onlyoffice/config/{id}   → 回傳前端 docEditor 用的 config（含 JWT）
/// POST /api/onlyoffice/callback/{id} → OnlyOffice Document Server 回呼（不驗 JWT，自行驗 OnlyOffice token）
/// GET  /api/onlyoffice/file/{id}?ticket=... → OnlyOffice 從這裡抓檔案內容（不驗 JWT，用 ticket）
/// </summary>
[Route("api/onlyoffice")]
public class OnlyOfficeController : BaseController
{
    private readonly OnlyOfficeService _office;
    private readonly FileService _files;
    private readonly EditLockService _locks;
    private readonly AuditService _audit;

    public OnlyOfficeController(OnlyOfficeService office, FileService files, EditLockService locks, AuditService audit)
    {
        _office = office;
        _files = files;
        _locks = locks;
        _audit = audit;
    }

    /// <summary>
    /// 前端取得 docEditor config。需登入。
    /// 同時也會嘗試取得編輯鎖：取不到則 mode=view（唯讀）。
    /// </summary>
    [HttpGet("config/{id}")]
    [Authorize]
    public async Task<IActionResult> GetConfig(string id)
    {
        if (string.IsNullOrWhiteSpace(_office.DocumentServerUrl))
            return BadRequest(new { message = "OnlyOffice 尚未設定，請聯絡系統管理員。" });

        var file = await _files.GetByIdAsync(id);
        if (file.Type != "file")
            return BadRequest(new { message = "資料夾無法以 OnlyOffice 編輯" });

        var ext = Path.GetExtension(file.Name).ToLowerInvariant().TrimStart('.');
        var documentType = ext switch
        {
            "docx" or "doc" or "odt" or "rtf" or "txt" => "word",
            "xlsx" or "xls" or "ods" or "csv" => "cell",
            "pptx" or "ppt" or "odp" => "slide",
            _ => null,
        };
        if (documentType == null)
            return BadRequest(new { message = $"OnlyOffice 不支援的格式：.{ext}" });

        var userId = GetUserId();
        var userName = GetUserName();
        var (gotLock, lockInfo) = await _locks.AcquireAsync(id, userId, userName);
        var mode = gotLock ? "edit" : "view";

        // ticket：回呼時用以授權 OnlyOffice 抓檔
        var ticket = TicketHelper.Generate(id, _office.JwtSecret);

        var fileUrl  = $"{_office.CallbackBaseUrl}/api/onlyoffice/file/{id}?ticket={ticket}";
        var callback = $"{_office.CallbackBaseUrl}/api/onlyoffice/callback/{id}?ticket={ticket}";

        // OnlyOffice document key：同檔不同版本要不同；用 UpdatedAt 當 hash
        var key = $"{id}-{file.UpdatedAt}".Replace(":", "").Replace("-", "").Substring(0, Math.Min(40, $"{id}{file.UpdatedAt}".Length));

        var config = new
        {
            document = new
            {
                fileType = ext,
                key,
                title = file.Name,
                url = fileUrl,
                permissions = new
                {
                    edit = gotLock,
                    download = true,
                    print = true,
                },
            },
            documentType,
            editorConfig = new
            {
                mode,
                lang = "zh-TW",
                callbackUrl = callback,
                user = new { id = userId, name = userName },
                customization = new
                {
                    autosave = true,
                    forcesave = true,
                    chat = false,
                    comments = true,
                    help = false,
                },
            },
            type = "desktop",
            documentServerUrl = _office.DocumentServerUrl,
            lockedBy = gotLock ? null : lockInfo?.UserName,
            token = "",
        };

        // 簽 JWT（OnlyOffice 啟用 JWT 時必填）
        var token = _office.SignToken(new
        {
            config.document,
            config.documentType,
            config.editorConfig,
        });

        await _audit.AddAsync(new Models.CreateAuditLogRequest
        {
            UserId = userId,
            UserName = userName,
            Action = "編輯",
            TargetName = file.Name,
            TargetId = id,
            Details = $"OnlyOffice 開啟（mode={mode}）",
        }, GetClientIp());

        return Ok(new
        {
            config.document,
            config.documentType,
            config.editorConfig,
            type = config.type,
            documentServerUrl = config.documentServerUrl,
            lockedBy = config.lockedBy,
            token,
        });
    }

    /// <summary>OnlyOffice → DMS-VM 回呼。允許匿名，但驗 OnlyOffice JWT + ticket。</summary>
    [HttpPost("callback/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback(string id, [FromQuery] string ticket, [FromBody] OnlyOfficeCallback body)
    {
        if (!TicketHelper.Validate(ticket, id, _office.JwtSecret))
            return Unauthorized(new { error = 1 });

        // 驗 OnlyOffice JWT（body.token 或 Authorization）
        if (_office.JwtEnabled)
        {
            var token = body.Token;
            if (string.IsNullOrEmpty(token))
            {
                var auth = Request.Headers["Authorization"].ToString();
                if (auth.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                    token = auth.Substring(7);
            }
            if (string.IsNullOrEmpty(token) || !_office.TryValidateToken(token, out _))
                return Unauthorized(new { error = 1 });
        }

        var result = await _office.HandleCallbackAsync(id, body);
        return Ok(result);
    }

    /// <summary>
    /// 連線診斷端點：檢查 DMS → OnlyOffice Document Server 是否可達、JWT 是否啟用、callback URL 對不對。
    /// 使用方式：登入後 GET /api/onlyoffice/diagnose
    /// </summary>
    [HttpGet("diagnose")]
    [Authorize]
    public async Task<IActionResult> Diagnose([FromServices] IHttpClientFactory httpFactory)
    {
        var result = new Dictionary<string, object?>
        {
            ["documentServerUrl"] = _office.DocumentServerUrl,
            ["callbackBaseUrl"] = _office.CallbackBaseUrl,
            ["jwtEnabled"] = _office.JwtEnabled,
            ["jwtSecretLength"] = _office.JwtSecret?.Length ?? 0,
        };

        // 1. 測 DMS-VM → OnlyOffice-VM 的連線（OnlyOffice healthcheck）
        try
        {
            using var http = httpFactory.CreateClient("OnlyOffice");
            http.Timeout = TimeSpan.FromSeconds(5);
            var resp = await http.GetAsync($"{_office.DocumentServerUrl}/healthcheck");
            var body = await resp.Content.ReadAsStringAsync();
            result["docServerReachable"] = resp.IsSuccessStatusCode;
            result["docServerStatus"] = (int)resp.StatusCode;
            result["docServerBody"] = body.Length > 200 ? body.Substring(0, 200) : body;
        }
        catch (Exception ex)
        {
            result["docServerReachable"] = false;
            result["docServerError"] = ex.Message;
        }

        // 2. 簽一個樣本 token，前端可拿去 jwt.io 解碼確認
        var sampleToken = _office.SignToken(new
        {
            document = new { fileType = "docx", key = "test", title = "test.docx", url = "https://example.com/test.docx" },
            documentType = "word",
        });
        result["sampleToken"] = sampleToken;

        return Ok(result);
    }

    /// <summary>OnlyOffice → DMS-VM 抓檔案。允許匿名，用 ticket 防止外部任意下載。</summary>
    [HttpGet("file/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFile(string id, [FromQuery] string ticket)
    {
        if (!TicketHelper.Validate(ticket, id, _office.JwtSecret))
            return Unauthorized();

        var (data, fileName, contentType) = await _files.DownloadAsync(id);
        return File(data, contentType, fileName);
    }
}

/// <summary>
/// 短時效 ticket：用 HMAC(secret, fileId|expireUnix) 產出，避免 OnlyOffice callback / 取檔被偽造。
/// </summary>
internal static class TicketHelper
{
    public static string Generate(string fileId, string secret)
    {
        var exp = DateTimeOffset.UtcNow.AddHours(8).ToUnixTimeSeconds();
        var sig = Sign($"{fileId}|{exp}", secret);
        return $"{exp}.{sig}";
    }

    public static bool Validate(string ticket, string fileId, string secret)
    {
        if (string.IsNullOrWhiteSpace(ticket)) return false;
        var parts = ticket.Split('.', 2);
        if (parts.Length != 2) return false;
        if (!long.TryParse(parts[0], out var exp)) return false;
        if (DateTimeOffset.UtcNow.ToUnixTimeSeconds() > exp) return false;
        var expected = Sign($"{fileId}|{exp}", secret);
        return CryptographicEquals(expected, parts[1]);
    }

    private static string Sign(string data, string secret)
    {
        using var hmac = new System.Security.Cryptography.HMACSHA256(System.Text.Encoding.UTF8.GetBytes(secret ?? ""));
        var bytes = hmac.ComputeHash(System.Text.Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool CryptographicEquals(string a, string b)
    {
        if (a.Length != b.Length) return false;
        var diff = 0;
        for (var i = 0; i < a.Length; i++) diff |= a[i] ^ b[i];
        return diff == 0;
    }
}
