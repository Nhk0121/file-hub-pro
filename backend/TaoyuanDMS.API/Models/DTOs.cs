namespace TaoyuanDMS.API.Models;

// ===== Auth =====
public record LoginRequest(string Username, string Password);
public record LoginResponse(string Token, UserDto User);
public record ChangePasswordRequest(string OldPassword, string NewPassword);

// ===== User =====
public class UserDto
{
    public string Id { get; set; } = "";
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
    public string Role { get; set; } = "使用者";
    public string? ApplicantType { get; set; }
    public string? EmployeeCode { get; set; }
    public string? Department { get; set; }
    public string? Section { get; set; }
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? Extension { get; set; }
}

public class CreateUserRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
    public string Role { get; set; } = "使用者";
    public string? ApplicantType { get; set; }
    public string? Department { get; set; }
    public string? Section { get; set; }
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? Extension { get; set; }
}

public class UpdateUserRequest
{
    public string? DisplayName { get; set; }
    public string? Email { get; set; }
    public string? Department { get; set; }
    public string? Section { get; set; }
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? Extension { get; set; }
}

public record UpdateRoleRequest(string Role);

// ===== File =====
public class FileDto
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Type { get; set; } = "file";
    public string? MimeType { get; set; }
    public long? Size { get; set; }
    public string? ParentId { get; set; }
    public string? Content { get; set; }
    public bool IsSystem { get; set; }
    public string? FolderLevel { get; set; }
    public string? DiskPath { get; set; }
    public string CreatedBy { get; set; } = "";
    public string CreatedAt { get; set; } = "";
    public string UpdatedAt { get; set; } = "";
}

public record CreateFolderRequest(string Name, string? ParentId);
public record RenameRequest(string Name);
public record UpdateContentRequest(string Content);

// ===== Trash =====
public class TrashItemDto
{
    public FileDto Item { get; set; } = new();
    public string DeletedAt { get; set; } = "";
    public string DeletedBy { get; set; } = "";
    public string? OriginalParentId { get; set; }
}

// ===== Audit =====
public class AuditLogDto
{
    public string Id { get; set; } = "";
    public string Timestamp { get; set; } = "";
    public string UserId { get; set; } = "";
    public string UserName { get; set; } = "";
    public string Action { get; set; } = "";
    public string? TargetName { get; set; }
    public string? TargetId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}

public class CreateAuditLogRequest
{
    public string UserId { get; set; } = "";
    public string UserName { get; set; } = "";
    public string Action { get; set; } = "";
    public string? TargetName { get; set; }
    public string? TargetId { get; set; }
    public string? Details { get; set; }
}

// ===== Permission =====
public class FolderPermissionDto
{
    public string Id { get; set; } = "";
    public string FolderId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string Permission { get; set; } = "";
}

public record SetPermissionRequest(string FolderId, string UserId, string Permission);

public class PermanentZoneOverrideDto
{
    public string Id { get; set; } = "";
    public string UserId { get; set; } = "";
    public string[] Departments { get; set; } = Array.Empty<string>();
}

public record SetPermanentOverrideRequest(string UserId, string[] Departments);

// ===== EditLock =====
public class EditLockDto
{
    public string FileId { get; set; } = "";
    public string UserId { get; set; } = "";
    public string UserName { get; set; } = "";
    public string LockedAt { get; set; } = "";
}

// ===== Storage =====
public class DepartmentQuotaDto
{
    public string Department { get; set; } = "";
    public string Zone { get; set; } = "";
    public int QuotaMB { get; set; }
    public int UsedMB { get; set; }
}

public record UpdateQuotaRequest(string Department, string Zone, int QuotaMB);

public class StorageSettingsDto
{
    public string PrimaryPath { get; set; } = "";
    public bool AutoCreateFolders { get; set; }
    public bool BackupEnabled { get; set; }
    public string BackupFrequency { get; set; } = "每日";
    public string BackupTime { get; set; } = "02:00";
    public int BackupRetentionDays { get; set; } = 30;
    public string UpdatedAt { get; set; } = "";
}

public record UpdateStorageSettingsRequest(
    string PrimaryPath,
    bool AutoCreateFolders,
    bool BackupEnabled,
    string BackupFrequency,
    string BackupTime,
    int BackupRetentionDays);

public class BackupDiskDto
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Path { get; set; } = "";
    public bool Enabled { get; set; }
    public string CreatedAt { get; set; } = "";
    public string? LastSyncAt { get; set; }
}

public record CreateBackupDiskRequest(string Label, string Path);
public record UpdateBackupDiskRequest(string? Label, string? Path, bool? Enabled);

public class InitializeFoldersResultDto
{
    public int Created { get; set; }
    public int Skipped { get; set; }
    public List<string> Paths { get; set; } = new();
    public List<string> Errors { get; set; } = new();
}

// ===== Registration =====
public class RegistrationDto
{
    public string Id { get; set; } = "";
    public string ApplicantType { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
    public string? Department { get; set; }
    public string? Section { get; set; }
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? Extension { get; set; }
    public string Status { get; set; } = "待審核";
    public string CreatedAt { get; set; } = "";
    public string? ReviewedBy { get; set; }
    public string? ReviewedAt { get; set; }
    public string? RejectReason { get; set; }
}

public class SubmitRegistrationRequest
{
    public string ApplicantType { get; set; } = "";
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? Email { get; set; }
    public string? Department { get; set; }
    public string? Section { get; set; }
    public string? JobTitle { get; set; }
    public string? Phone { get; set; }
    public string? Extension { get; set; }
}

public record ReviewRegistrationRequest(string Status, string ReviewerName, string? RejectReason);

// ===== Section =====
public record SectionRequest(string Department, string Section);
