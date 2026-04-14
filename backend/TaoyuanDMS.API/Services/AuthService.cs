using Dapper;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class AuthService
{
    private readonly DbConnectionFactory _db;
    private readonly IConfiguration _config;

    public AuthService(DbConnectionFactory db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<LoginResponse> LoginAsync(string username, string password)
    {
        using var conn = _db.CreateConnection();
        var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT * FROM Users WHERE Username = @Username AND IsActive = 1",
            new { Username = username });

        if (user == null)
            throw new UnauthorizedAccessException("帳號或密碼錯誤");

        string? passwordHash = (string?)user.PasswordHash;
        if (string.IsNullOrEmpty(passwordHash) || !BCrypt.Net.BCrypt.Verify(password, passwordHash))
            throw new UnauthorizedAccessException("帳號或密碼錯誤");

        var token = GenerateJwtToken(user);
        return new LoginResponse(token, MapToUserDto(user));
    }

    public async Task ChangePasswordAsync(string userId, string oldPassword, string newPassword)
    {
        using var conn = _db.CreateConnection();
        var hash = await conn.QueryFirstOrDefaultAsync<string>(
            "SELECT PasswordHash FROM Users WHERE Id = @Id", new { Id = userId });

        if (hash == null || !BCrypt.Net.BCrypt.Verify(oldPassword, hash))
            throw new UnauthorizedAccessException("舊密碼錯誤");

        var newHash = BCrypt.Net.BCrypt.HashPassword(newPassword);
        await conn.ExecuteAsync(
            "UPDATE Users SET PasswordHash = @Hash, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { Hash = newHash, Id = userId });
    }

    public async Task<UserDto> GetProfileAsync(string userId)
    {
        using var conn = _db.CreateConnection();
        var user = await conn.QueryFirstOrDefaultAsync<dynamic>(
            "SELECT * FROM Users WHERE Id = @Id", new { Id = userId });
        return user == null ? throw new Exception("使用者不存在") : MapToUserDto(user);
    }

    public async Task<UserDto> UpdateProfileAsync(string userId, UpdateUserRequest req)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE Users SET
                DisplayName = COALESCE(@DisplayName, DisplayName),
                Email = COALESCE(@Email, Email),
                Department = COALESCE(@Department, Department),
                Section = COALESCE(@Section, Section),
                JobTitle = COALESCE(@JobTitle, JobTitle),
                Phone = COALESCE(@Phone, Phone),
                Extension = COALESCE(@Extension, Extension),
                UpdatedAt = GETUTCDATE()
            WHERE Id = @Id",
            new { req.DisplayName, req.Email, req.Department, req.Section, req.JobTitle, req.Phone, req.Extension, Id = userId });

        return await GetProfileAsync(userId);
    }

    private string GenerateJwtToken(dynamic user)
    {
        var key = _config["Jwt:Key"] ?? "TaoyuanDMS_SuperSecret_Key_2024!@#$%^&*()";
        var securityKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key));
        var credentials = new SigningCredentials(securityKey, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, (string)user.Id),
            new Claim(ClaimTypes.Name, (string)user.Username),
            new Claim(ClaimTypes.Role, (string)user.Role),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"] ?? "TaoyuanDMS",
            audience: _config["Jwt:Audience"] ?? "TaoyuanDMS",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public static UserDto MapToUserDto(dynamic u) => new()
    {
        Id = u.Id,
        Username = u.Username,
        DisplayName = u.DisplayName,
        Email = u.Email,
        Role = u.Role,
        ApplicantType = u.ApplicantType,
        EmployeeCode = u.EmployeeCode,
        Department = u.Department,
        Section = u.Section,
        JobTitle = u.JobTitle,
        Phone = u.Phone,
        Extension = u.Extension,
    };
}
