using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/trash")]
[Authorize]
public class TrashController : BaseController
{
    private readonly TrashService _trash;

    public TrashController(TrashService trash) => _trash = trash;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _trash.GetAllAsync());

    [HttpPost("{id}/restore")]
    public async Task<IActionResult> Restore(string id)
    {
        await _trash.RestoreAsync(id);
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> PermanentDelete(string id)
    {
        await _trash.PermanentDeleteAsync(id);
        return Ok();
    }

    [HttpDelete]
    public async Task<IActionResult> EmptyTrash()
    {
        await _trash.EmptyTrashAsync();
        return Ok();
    }
}
