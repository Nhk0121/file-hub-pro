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

    // ----- 配額 -----
    [HttpGet("quotas")]
    public async Task<IActionResult> GetQuotas() => Ok(await _storage.GetQuotasAsync());

    [HttpPut("quotas")]
    public async Task<IActionResult> UpdateQuota([FromBody] UpdateQuotaRequest req)
    {
        if (!IsAdmin()) return Forbid();
        await _storage.UpdateQuotaAsync(req.Department, req.Zone, req.QuotaMB);
        return Ok();
    }

    // ----- 磁碟使用量 -----
    [HttpGet("disk-usage")]
    public async Task<IActionResult> GetDiskUsage() => Ok(await _storage.GetDiskUsageAsync());

    // ----- 系統設定 -----
    [HttpGet("settings")]
    public async Task<IActionResult> GetSettings() => Ok(await _storage.GetSettingsAsync());

    [HttpPut("settings")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateStorageSettingsRequest req)
    {
        if (!IsAdmin()) return Forbid();
        await _storage.UpdateSettingsAsync(req);
        return Ok();
    }

    // ----- 備份磁碟 -----
    [HttpGet("disks")]
    public async Task<IActionResult> GetDisks() => Ok(await _storage.GetDisksAsync());

    [HttpPost("disks")]
    public async Task<IActionResult> AddDisk([FromBody] CreateBackupDiskRequest req)
    {
        if (!IsAdmin()) return Forbid();
        return Ok(await _storage.AddDiskAsync(req));
    }

    [HttpPut("disks/{id}")]
    public async Task<IActionResult> UpdateDisk(string id, [FromBody] UpdateBackupDiskRequest req)
    {
        if (!IsAdmin()) return Forbid();
        await _storage.UpdateDiskAsync(id, req);
        return Ok();
    }

    [HttpDelete("disks/{id}")]
    public async Task<IActionResult> RemoveDisk(string id)
    {
        if (!IsAdmin()) return Forbid();
        await _storage.RemoveDiskAsync(id);
        return Ok();
    }

    // ----- 移機自動建立資料夾 -----
    [HttpPost("initialize-folders")]
    public async Task<IActionResult> InitializeFolders()
    {
        if (!IsAdmin()) return Forbid();
        return Ok(await _storage.InitializeFoldersAsync());
    }

    private bool IsAdmin()
    {
        var role = GetUserRole();
        return role == "系統管理員" || role == "管理員";
    }
}
