using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Models;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/permissions")]
[Authorize]
public class PermissionsController : BaseController
{
    private readonly PermissionService _perms;

    public PermissionsController(PermissionService perms) => _perms = perms;

    [HttpGet]
    public async Task<IActionResult> GetRules() => Ok(await _perms.GetRulesAsync());

    [HttpPost]
    public async Task<IActionResult> SetPermission([FromBody] SetPermissionRequest req)
    {
        await _perms.SetPermissionAsync(req.FolderId, req.UserId, req.Permission);
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> RemoveRule(string id)
    {
        await _perms.RemoveRuleAsync(id);
        return Ok();
    }

    [HttpGet("permanent-overrides")]
    public async Task<IActionResult> GetOverrides() => Ok(await _perms.GetOverridesAsync());

    [HttpPost("permanent-overrides")]
    public async Task<IActionResult> SetOverride([FromBody] SetPermanentOverrideRequest req)
    {
        await _perms.SetOverrideAsync(req.UserId, req.Departments);
        return Ok();
    }

    [HttpDelete("permanent-overrides/{id}")]
    public async Task<IActionResult> RemoveOverride(string id)
    {
        await _perms.RemoveOverrideAsync(id);
        return Ok();
    }
}
