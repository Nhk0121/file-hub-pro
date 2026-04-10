using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Models;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/audit")]
[Authorize]
public class AuditController : BaseController
{
    private readonly AuditService _audit;

    public AuditController(AuditService audit) => _audit = audit;

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] int page = 1, [FromQuery] int pageSize = 100)
        => Ok(await _audit.GetAllAsync(page, pageSize));

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] CreateAuditLogRequest req)
    {
        await _audit.AddAsync(req, GetClientIp());
        return Ok();
    }

    [HttpDelete]
    public async Task<IActionResult> Clear()
    {
        if (GetUserRole() != "系統管理員") return Forbid();
        await _audit.ClearAsync();
        return Ok();
    }

    [HttpGet("export")]
    public async Task<IActionResult> Export()
    {
        var csv = await _audit.ExportCsvAsync();
        return File(csv, "text/csv; charset=utf-8", $"audit_{DateTime.Now:yyyyMMdd}.csv");
    }
}
