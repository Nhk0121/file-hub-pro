using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Models;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/shares")]
public class SharesController : BaseController
{
    private readonly ShareService _shares;
    private readonly AuditService _audit;

    public SharesController(ShareService shares, AuditService audit)
    {
        _shares = shares;
        _audit = audit;
    }

    // === 已登入使用者：建立／管理分享 ===

    [Authorize]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateShareRequest req)
    {
        var role = GetUserRole();
        // 員工以上可建立（不含外包人員）
        if (role == "外包人員")
            return Forbid();

        var dto = await _shares.CreateAsync(req.FileId, GetUserId(), GetUserName());
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "分享", TargetId = req.FileId,
            TargetName = dto.FileName,
            Details = $"建立公開分享連結 token={dto.Token[..8]}…"
        }, GetClientIp());
        return Ok(dto);
    }

    [Authorize]
    [HttpGet]
    public async Task<IActionResult> List()
    {
        var role = GetUserRole();
        var isAdmin = role == "系統管理員" || role == "管理員";
        // 一般使用者只看自己的；管理員可看全部
        var rows = isAdmin
            ? await _shares.ListAsync()
            : await _shares.ListAsync(GetUserId());
        return Ok(rows);
    }

    [Authorize]
    [HttpDelete("{token}")]
    public async Task<IActionResult> Revoke(string token)
    {
        var role = GetUserRole();
        var isAdmin = role == "系統管理員" || role == "管理員";
        await _shares.RevokeAsync(token, GetUserId(), isAdmin);
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "撤銷分享", TargetId = token[..Math.Min(8, token.Length)]
        }, GetClientIp());
        return Ok();
    }

    // === 公開（不需登入） ===

    [AllowAnonymous]
    [HttpGet("public/{token}")]
    public async Task<IActionResult> GetPublicInfo(string token)
        => Ok(await _shares.GetPublicInfoAsync(token));

    [AllowAnonymous]
    [HttpGet("public/{token}/download")]
    public async Task<IActionResult> PublicDownload(string token)
    {
        var (data, fileName, contentType) = await _shares.DownloadByTokenAsync(token);
        return File(data, contentType, fileName);
    }
}
