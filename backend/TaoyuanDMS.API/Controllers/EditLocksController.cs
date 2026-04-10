using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/edit-locks")]
[Authorize]
public class EditLocksController : BaseController
{
    private readonly EditLockService _locks;

    public EditLocksController(EditLockService locks) => _locks = locks;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _locks.GetAllAsync());

    [HttpPost("{fileId}")]
    public async Task<IActionResult> Acquire(string fileId)
    {
        var (success, lockDto) = await _locks.AcquireAsync(fileId, GetUserId(), GetUserName());
        return Ok(new { success, @lock = lockDto });
    }

    [HttpDelete("{fileId}")]
    public async Task<IActionResult> Release(string fileId)
    {
        await _locks.ReleaseAsync(fileId, GetUserId());
        return Ok();
    }
}
