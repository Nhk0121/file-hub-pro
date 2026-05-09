using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Models;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/auth")]
public class AuthController : BaseController
{
    private readonly AuthService _auth;
    private readonly AuditService _audit;

    public AuthController(AuthService auth, AuditService audit) { _auth = auth; _audit = audit; }

    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        try
        {
            var result = await _auth.LoginAsync(req.Username, req.Password);
            await _audit.AddAsync(new CreateAuditLogRequest
            {
                UserId = result.User.Id, UserName = result.User.DisplayName,
                Action = "登入", Details = "登入成功"
            }, GetClientIp());
            return Ok(result);
        }
        catch (AccountSuspendedException ex)
        {
            return StatusCode(403, new { message = ex.Message, suspended = true });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Unauthorized(new { message = ex.Message });
        }
    }

    [HttpPost("logout")]
    [Authorize]
    public async Task<IActionResult> Logout()
    {
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "登出"
        }, GetClientIp());
        return Ok();
    }

    [HttpGet("profile")]
    [Authorize]
    public async Task<IActionResult> GetProfile()
    {
        var user = await _auth.GetProfileAsync(GetUserId());
        return Ok(user);
    }

    [HttpPut("profile")]
    [Authorize]
    public async Task<IActionResult> UpdateProfile([FromBody] UpdateUserRequest req)
    {
        var user = await _auth.UpdateProfileAsync(GetUserId(), req);
        return Ok(user);
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        try
        {
            await _auth.ChangePasswordAsync(GetUserId(), req.OldPassword, req.NewPassword);
            return Ok();
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}
