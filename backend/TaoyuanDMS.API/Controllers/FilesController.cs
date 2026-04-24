using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Models;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/files")]
[Authorize]
public class FilesController : BaseController
{
    private readonly FileService _files;
    private readonly AuditService _audit;

    public FilesController(FileService files, AuditService audit) { _files = files; _audit = audit; }

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? parentId)
    {
        if (parentId != null)
            return Ok(await _files.GetChildrenAsync(string.IsNullOrEmpty(parentId) ? null : parentId));
        return Ok(await _files.GetAllAsync());
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(string id) => Ok(await _files.GetByIdAsync(id));

    [HttpPost("folder")]
    public async Task<IActionResult> CreateFolder([FromBody] CreateFolderRequest req)
    {
        var folder = await _files.CreateFolderAsync(req.Name, req.ParentId, GetUserName());
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "建立資料夾", TargetName = req.Name, TargetId = folder.Id
        }, GetClientIp());
        return Ok(folder);
    }

    [HttpPost("upload")]
    public async Task<IActionResult> Upload(IFormFile file, [FromForm] string? parentId)
    {
        var result = await _files.UploadAsync(file, parentId, GetUserName());
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "上傳", TargetName = file.FileName, TargetId = result.Id
        }, GetClientIp());
        return Ok(result);
    }

    [HttpPost("{id}/trash")]
    public async Task<IActionResult> MoveToTrash(string id, [FromServices] TrashService trash)
    {
        await trash.MoveToTrashAsync(id, GetUserName());
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "刪除", TargetId = id
        }, GetClientIp());
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        await _files.DeleteAsync(id);
        return Ok();
    }

    [HttpPut("{id}/rename")]
    public async Task<IActionResult> Rename(string id, [FromBody] RenameRequest req)
    {
        var file = await _files.RenameAsync(id, req.Name);
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "重新命名", TargetName = req.Name, TargetId = id
        }, GetClientIp());
        return Ok(file);
    }

    [HttpPut("{id}/content")]
    public async Task<IActionResult> UpdateContent(string id, [FromBody] UpdateContentRequest req)
    {
        var file = await _files.UpdateContentAsync(id, req.Content);
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "編輯", TargetId = id
        }, GetClientIp());
        return Ok(file);
    }

    [HttpGet("{id}/download")]
    public async Task<IActionResult> Download(string id)
    {
        var (data, fileName, contentType) = await _files.DownloadAsync(id);
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "下載", TargetName = fileName, TargetId = id
        }, GetClientIp());
        return File(data, contentType, fileName);
    }

    // === Sections ===
    [HttpGet("sections")]
    public async Task<IActionResult> GetSections([FromServices] SectionService sections)
    {
        var data = await sections.GetAllAsync();
        return Ok(data);
    }

    [HttpPost("sections")]
    public async Task<IActionResult> AddSection(
        [FromBody] SectionRequest req,
        [FromServices] SectionService sections,
        [FromServices] StorageService storage)
    {
        await sections.AddAsync(req.Department, req.Section);
        // 同步在主磁碟與啟用的備份磁碟建立實體資料夾
        var folderResult = await storage.CreateSectionFoldersAsync(req.Department, req.Section);
        // 同步寫入 Files 表的系統資料夾紀錄
        await _files.EnsureSystemFoldersAsync(force: true);
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "建立資料夾",
            TargetName = $"{req.Department}/{req.Section}",
            Details = $"新建 {folderResult.Created} 個、略過 {folderResult.Skipped} 個資料夾"
        }, GetClientIp());
        return Ok(folderResult);
    }

    [HttpDelete("sections")]
    public async Task<IActionResult> RemoveSection(
        [FromBody] SectionRequest req,
        [FromServices] SectionService sections,
        [FromServices] StorageService storage)
    {
        await sections.RemoveAsync(req.Department, req.Section);
        var folderResult = await storage.RemoveSectionFoldersAsync(req.Department, req.Section);
        await _files.EnsureSystemFoldersAsync(force: true);
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "刪除",
            TargetName = $"{req.Department}/{req.Section}",
            Details = $"已移除 {folderResult.Created} 個資料夾、略過 {folderResult.Skipped + folderResult.Errors.Count} 個"
        }, GetClientIp());
        return Ok(folderResult);
    }

    // === System Folders Status / Manual Re-init ===
    [HttpGet("system-status")]
    public async Task<IActionResult> GetSystemStatus()
        => Ok(await _files.GetSystemFolderStatusAsync());

    [HttpPost("system-reinit")]
    public async Task<IActionResult> ReinitSystemFolders()
    {
        var role = GetUserRole();
        if (role != "系統管理員" && role != "管理員")
            return Forbid();

        await _files.EnsureSystemFoldersAsync(force: true);
        var status = await _files.GetSystemFolderStatusAsync();
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "建立資料夾",
            TargetName = "系統資料夾",
            Details = $"手動重新初始化:共 {status.TotalSystemFolders}/{status.ExpectedSystemFolders} 個 ({status.LastDurationMs}ms)"
        }, GetClientIp());
        return Ok(status);
    }

    // === 系統管理員：強制刪除任一資料夾（含系統殘留） ===
    [HttpDelete("{id}/force")]
    public async Task<IActionResult> ForceDelete(string id)
    {
        var role = GetUserRole();
        if (role != "系統管理員")
            return Forbid();

        await _files.ForceDeleteAsync(id);
        await _audit.AddAsync(new CreateAuditLogRequest
        {
            UserId = GetUserId(), UserName = GetUserName(),
            Action = "刪除", TargetId = id,
            Details = "系統管理員強制刪除（清除殘留資料夾）"
        }, GetClientIp());
        return Ok();
    }
}
