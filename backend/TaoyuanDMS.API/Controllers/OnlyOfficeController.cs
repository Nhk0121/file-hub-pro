using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

/// <summary>
/// OnlyOffice Document Server 整合端點
/// - GET /api/onlyoffice/config/{id}   產生前端 DocsAPI 設定（需登入）
/// - GET /api/onlyoffice/file/{id}     供 DocServer 拉取原始檔（用一次性 token,匿名）
/// - POST /api/onlyoffice/callback/{id} 供 DocServer 回呼儲存（匿名,JWT 驗章）
/// - GET /api/onlyoffice/diagnose      簡易健康檢查（需登入）
/// </summary>
[Route("api/onlyoffice")]
public class OnlyOfficeController : BaseController
{
    private readonly OnlyOfficeService _oo;
    private readonly FileService _files;
    private readonly AuditService _audit;
    private readonly IHttpClientFactory _httpFactory;
    private readonly IConfiguration _config;

    public OnlyOfficeController(
        OnlyOfficeService oo, FileService files, AuditService audit,
        IHttpClientFactory httpFactory, IConfiguration config)
    {
        _oo = oo; _files = files; _audit = audit;
        _httpFactory = httpFactory; _config = config;
    }

    [HttpGet("config/{id}")]
    [Authorize]
    public async Task<IActionResult> GetConfig(string id)
    {
        var file = await _files.GetByIdAsync(id);
        var docType = OnlyOfficeService.DetectDocumentType(file.Name);
        if (docType == null)
            return BadRequest(new { message = $"檔案類型不支援線上編輯：{file.Name}" });

        // 簽一次性 token,夾在 DocServer 拉檔/回呼的 URL 上
        var serviceToken = _oo.Sign(new
        {
            sub = "onlyoffice-service",
            fileId = id,
            exp = DateTimeOffset.UtcNow.AddHours(8).ToUnixTimeSeconds(),
        });

        var callbackBase = _oo.CallbackBaseUrl.TrimEnd('/');
        var ext = Path.GetExtension(file.Name).TrimStart('.').ToLowerInvariant();
        var docKey = $"{id}-{file.UpdatedAt:yyyyMMddHHmmss}";

        var documentConfig = new
        {
            fileType = ext,
            key = docKey,
            title = file.Name,
            url = $"{callbackBase}/api/onlyoffice/file/{id}?token={serviceToken}",
            permissions = new
            {
                edit = true,
                download = true,
                print = true,
                review = false,
            },
        };

        var editorConfig = new
        {
            mode = "edit",
            lang = "zh-TW",
            callbackUrl = $"{callbackBase}/api/onlyoffice/callback/{id}?token={serviceToken}",
            user = new
            {
                id = GetUserId(),
                name = GetUserName(),
            },
            customization = new
            {
                autosave = true,
                forcesave = true,
                chat = false,
                comments = false,
                help = false,
            },
        };

        var payload = new
        {
            document = documentConfig,
            editorConfig,
            documentType = docType,
        };

        // 整包再簽一次,供前端帶給 DocsAPI
        var token = _oo.Sign(new
        {
            payload = JsonSerializer.Serialize(payload),
            exp = DateTimeOffset.UtcNow.AddHours(8).ToUnixTimeSeconds(),
        });

        await _audit.AddAsync(new Models.CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "編輯", TargetName = file.Name, TargetId = id,
            Details = "開啟 OnlyOffice 線上編輯",
        }, GetClientIp());

        return Ok(new
        {
            document = documentConfig,
            editorConfig,
            documentType = docType,
            token,
            documentServerUrl = _oo.PublicDocumentServerUrl,
        });
    }

    /// <summary>DocServer 透過此 URL 拉取原始檔（匿名,驗 token）。</summary>
    [HttpGet("file/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetFile(string id, [FromQuery] string token)
    {
        try
        {
            var claims = _oo.Verify(token);
            if (!claims.TryGetValue("fileId", out var v) || v.GetString() != id)
                return Unauthorized();
        }
        catch
        {
            return Unauthorized();
        }

        var (data, name, contentType) = await _files.DownloadAsync(id);
        return File(data, contentType, name);
    }

    /// <summary>DocServer 儲存回呼（匿名,驗 token + payload JWT）。</summary>
    [HttpPost("callback/{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback(string id, [FromQuery] string token, [FromBody] JsonElement body)
    {
        try
        {
            var claims = _oo.Verify(token);
            if (!claims.TryGetValue("fileId", out var v) || v.GetString() != id)
                return Unauthorized();
        }
        catch
        {
            return Unauthorized();
        }

        // OnlyOffice callback 狀態：
        // 1 = 正在編輯; 2 = 儲存; 3 = 儲存錯誤; 4 = 無變更關閉; 6 = 強制儲存; 7 = 強制儲存錯誤
        var status = body.TryGetProperty("status", out var s) ? s.GetInt32() : 0;

        if (status == 2 || status == 6)
        {
            if (!body.TryGetProperty("url", out var urlEl) || urlEl.ValueKind != JsonValueKind.String)
                return Ok(new { error = 1, message = "缺少儲存 URL" });

            var downloadUrl = urlEl.GetString()!;
            try
            {
                var client = _httpFactory.CreateClient("OnlyOffice");
                var bytes = await client.GetByteArrayAsync(downloadUrl);
                await _files.OverwriteFileBytesAsync(id, bytes);

                await _audit.AddAsync(new Models.CreateAuditLogRequest
                {
                    UserId = body.TryGetProperty("users", out var u) && u.ValueKind == JsonValueKind.Array && u.GetArrayLength() > 0
                        ? u[0].GetString() ?? "onlyoffice" : "onlyoffice",
                    UserName = "OnlyOffice",
                    Action = "編輯",
                    TargetId = id,
                    Details = $"OnlyOffice 儲存 (status={status})",
                }, GetClientIp());
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[OnlyOffice Callback] 儲存失敗 id={id}: {ex.Message}");
                return Ok(new { error = 1, message = ex.Message });
            }
        }

        return Ok(new { error = 0 });
    }

    /// <summary>診斷：檢查 DocServer 是否可從 DMS 連到。</summary>
    [HttpGet("diagnose")]
    [Authorize]
    public async Task<IActionResult> Diagnose()
    {
        var internalUrl = _config["OnlyOffice:InternalDocumentServerUrl"]
            ?? throw new InvalidOperationException("未設定 OnlyOffice:InternalDocumentServerUrl");

        var client = _httpFactory.CreateClient("OnlyOffice");
        client.Timeout = TimeSpan.FromSeconds(5);
        try
        {
            var resp = await client.GetAsync($"{internalUrl.TrimEnd('/')}/healthcheck");
            var body = await resp.Content.ReadAsStringAsync();
            return Ok(new
            {
                ok = resp.IsSuccessStatusCode && body.Trim().Equals("true", StringComparison.OrdinalIgnoreCase),
                status = (int)resp.StatusCode,
                body,
                internalUrl,
                publicUrl = _oo.PublicDocumentServerUrl,
                callbackBaseUrl = _oo.CallbackBaseUrl,
            });
        }
        catch (Exception ex)
        {
            return Ok(new { ok = false, error = ex.Message, internalUrl });
        }
    }
}
