using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace TaoyuanDMS.API.Controllers;

[ApiController]
[Route("api")]
public abstract class BaseController : ControllerBase
{
    protected string GetUserId() =>
        User.FindFirstValue(ClaimTypes.NameIdentifier) ?? throw new UnauthorizedAccessException();

    protected string GetUserName() =>
        User.FindFirstValue(ClaimTypes.Name) ?? "unknown";

    protected string GetUserRole() =>
        User.FindFirstValue(ClaimTypes.Role) ?? "使用者";

    protected string? GetClientIp() =>
        HttpContext.Connection.RemoteIpAddress?.ToString();
}
