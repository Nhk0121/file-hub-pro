using Dapper;
using TaoyuanDMS.API.Models;

namespace TaoyuanDMS.API.Services;

public class UserService
{
    private readonly DbConnectionFactory _db;

    public UserService(DbConnectionFactory db) => _db = db;

    public async Task<List<UserDto>> GetAllAsync()
    {
        using var conn = _db.CreateConnection();
        var users = await conn.QueryAsync<dynamic>("SELECT * FROM Users WHERE IsActive = 1");
        return users.Select(AuthService.MapToUserDto).ToList();
    }

    public async Task<UserDto> CreateAsync(CreateUserRequest req)
    {
        using var conn = _db.CreateConnection();

        // 檢查帳號是否已存在於 Users 或待審核的 UserRegistrations
        var existsInUsers = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM Users WHERE Username = @Username AND IsActive = 1", new { req.Username });
        if (existsInUsers > 0) throw new Exception("帳號已存在，無法重複建立");

        var existsInRegs = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM UserRegistrations WHERE Username = @Username AND Status = '待審核'", new { req.Username });
        if (existsInRegs > 0) throw new Exception("此帳號已有待審核的申請");

        var id = Guid.NewGuid().ToString();
        var hash = BCrypt.Net.BCrypt.HashPassword(req.Password);

        await conn.ExecuteAsync(@"
            INSERT INTO Users (Id, Username, PasswordHash, DisplayName, Email, Role, ApplicantType, Department, Section, JobTitle, Phone, Extension)
            VALUES (@Id, @Username, @Hash, @DisplayName, @Email, @Role, @ApplicantType, @Department, @Section, @JobTitle, @Phone, @Extension)",
            new { Id = id, req.Username, Hash = hash, req.DisplayName, req.Email, req.Role, req.ApplicantType, req.Department, req.Section, req.JobTitle, req.Phone, req.Extension });

        return await GetByIdAsync(id);
    }

    public async Task<UserDto> UpdateAsync(string userId, UpdateUserRequest req)
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

        return await GetByIdAsync(userId);
    }

    public async Task UpdateRoleAsync(string userId, string role)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("UPDATE Users SET Role = @Role, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { Role = role, Id = userId });
    }

    public async Task ResetPasswordAsync(string userId)
    {
        using var conn = _db.CreateConnection();
        var hash = BCrypt.Net.BCrypt.HashPassword("a0123456789+");
        await conn.ExecuteAsync("UPDATE Users SET PasswordHash = @Hash, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { Hash = hash, Id = userId });
    }

    public async Task DeleteAsync(string userId)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync("UPDATE Users SET IsActive = 0, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { Id = userId });
    }

    public async Task SuspendAsync(string userId, bool suspended, string? reason)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(
            "UPDATE Users SET IsSuspended = @Suspended, SuspendReason = @Reason, UpdatedAt = GETUTCDATE() WHERE Id = @Id",
            new { Suspended = suspended, Reason = suspended ? reason : null, Id = userId });
    }

    public async Task<UserDto> GetByIdAsync(string id)
    {
        using var conn = _db.CreateConnection();
        var user = await conn.QueryFirstOrDefaultAsync<dynamic>("SELECT * FROM Users WHERE Id = @Id", new { Id = id });
        return user == null ? throw new Exception("使用者不存在") : AuthService.MapToUserDto(user);
    }

    // === Registrations ===
    public async Task<List<RegistrationDto>> GetRegistrationsAsync()
    {
        using var conn = _db.CreateConnection();
        var regs = await conn.QueryAsync<RegistrationDto>("SELECT * FROM UserRegistrations WHERE Status <> N'已核准' ORDER BY CreatedAt DESC");
        return regs.ToList();
    }

    public async Task SubmitRegistrationAsync(SubmitRegistrationRequest req)
    {
        using var conn = _db.CreateConnection();

        // 檢查帳號是否已存在於正式使用者
        var existsInUsers = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM Users WHERE Username = @Username AND IsActive = 1", new { req.Username });
        if (existsInUsers > 0) throw new Exception("帳號已存在，無法重複申請");

        // 檢查是否已有待審核的申請
        var existsInRegs = await conn.ExecuteScalarAsync<int>(
            "SELECT COUNT(1) FROM UserRegistrations WHERE Username = @Username AND Status = '待審核'", new { req.Username });
        if (existsInRegs > 0) throw new Exception("此帳號已有待審核的申請，請勿重複提交");

        await conn.ExecuteAsync(@"
            INSERT INTO UserRegistrations (ApplicantType, Username, Password, DisplayName, Email, Department, Section, JobTitle, Phone, Extension)
            VALUES (@ApplicantType, @Username, @Password, @DisplayName, @Email, @Department, @Section, @JobTitle, @Phone, @Extension)", req);
    }

    public async Task ReviewRegistrationAsync(string regId, ReviewRegistrationRequest req)
    {
        using var conn = _db.CreateConnection();
        await conn.ExecuteAsync(@"
            UPDATE UserRegistrations SET Status = @Status, ReviewedBy = @ReviewerName, ReviewedAt = GETUTCDATE(), RejectReason = @RejectReason
            WHERE Id = @Id",
            new { req.Status, req.ReviewerName, req.RejectReason, Id = regId });

        if (req.Status == "已核准")
        {
            var reg = await conn.QueryFirstAsync<dynamic>("SELECT * FROM UserRegistrations WHERE Id = @Id", new { Id = regId });
            var id = Guid.NewGuid().ToString();
            var hash = BCrypt.Net.BCrypt.HashPassword((string)reg.Password);
            var role = (string)reg.ApplicantType == "外包人員" ? "外包人員" : "使用者";

            await conn.ExecuteAsync(@"
                INSERT INTO Users (Id, Username, PasswordHash, DisplayName, Email, Role, ApplicantType, Department, Section, JobTitle, Phone, Extension)
                VALUES (@Id, @Username, @Hash, @DisplayName, @Email, @Role, @ApplicantType, @Department, @Section, @JobTitle, @Phone, @Extension)",
                new { Id = id, Username = (string)reg.Username, Hash = hash, DisplayName = (string)reg.DisplayName,
                    Email = (string?)reg.Email, Role = role, ApplicantType = (string)reg.ApplicantType,
                    Department = (string?)reg.Department, Section = (string?)reg.Section,
                    JobTitle = (string?)reg.JobTitle, Phone = (string?)reg.Phone, Extension = (string?)reg.Extension });
        }
    }
}
