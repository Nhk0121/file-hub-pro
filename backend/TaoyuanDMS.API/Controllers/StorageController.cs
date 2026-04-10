using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Models;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/storage")]
[Authorize]
public class StorageController : BaseController
{
    private readonly StorageService _storage;

    public StorageController(StorageService storage) => _storage = storage;

    [HttpGet("quotas")]
    public async Task<IActionResult> GetQuotas() => Ok(await _storage.GetQuotasAsync());

    [HttpPut("quotas")]
    public async Task<IActionResult> UpdateQuota([FromBody] UpdateQuotaRequest req)
    {
        if (GetUserRole() != "系統管理員" && GetUserRole() != "管理員") return Forbid();
        await _storage.UpdateQuotaAsync(req.Department, req.Zone, req.QuotaMB);
        return Ok();
    }

    [HttpGet("disk-usage")]
    public async Task<IActionResult> GetDiskUsage() => Ok(await _storage.GetDiskUsageAsync());
}
