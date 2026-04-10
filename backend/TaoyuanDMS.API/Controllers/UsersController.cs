using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TaoyuanDMS.API.Models;
using TaoyuanDMS.API.Services;

namespace TaoyuanDMS.API.Controllers;

[Route("api/users")]
[Authorize]
public class UsersController : BaseController
{
    private readonly UserService _users;

    public UsersController(UserService users) => _users = users;

    [HttpGet]
    public async Task<IActionResult> GetAll() => Ok(await _users.GetAllAsync());

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
    {
        if (GetUserRole() != "系統管理員" && GetUserRole() != "管理員")
            return Forbid();
        return Ok(await _users.CreateAsync(req));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateUserRequest req)
    {
        if (GetUserRole() != "系統管理員" && GetUserRole() != "管理員")
            return Forbid();
        return Ok(await _users.UpdateAsync(id, req));
    }

    [HttpPut("{id}/role")]
    public async Task<IActionResult> UpdateRole(string id, [FromBody] dynamic body)
    {
        if (GetUserRole() != "系統管理員" && GetUserRole() != "管理員")
            return Forbid();
        string role = body.GetProperty("role").GetString();
        await _users.UpdateRoleAsync(id, role);
        return Ok();
    }

    [HttpPost("{id}/reset-password")]
    public async Task<IActionResult> ResetPassword(string id)
    {
        if (GetUserRole() != "系統管理員" && GetUserRole() != "管理員")
            return Forbid();
        await _users.ResetPasswordAsync(id);
        return Ok();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(string id)
    {
        if (GetUserRole() != "系統管理員" && GetUserRole() != "管理員")
            return Forbid();
        await _users.DeleteAsync(id);
        return Ok();
    }

    // === Registrations ===
    [HttpGet("registrations")]
    public async Task<IActionResult> GetRegistrations() => Ok(await _users.GetRegistrationsAsync());

    [HttpPost("registrations")]
    [AllowAnonymous]
    public async Task<IActionResult> SubmitRegistration([FromBody] SubmitRegistrationRequest req)
    {
        await _users.SubmitRegistrationAsync(req);
        return Ok();
    }

    [HttpPost("registrations/{id}/review")]
    public async Task<IActionResult> ReviewRegistration(string id, [FromBody] ReviewRegistrationRequest req)
    {
        if (GetUserRole() != "系統管理員" && GetUserRole() != "管理員")
            return Forbid();
        await _users.ReviewRegistrationAsync(id, req);
        return Ok();
    }
}
