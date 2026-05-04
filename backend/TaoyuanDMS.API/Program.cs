using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using TaoyuanDMS.API.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "TaoyuanDMS_SuperSecret_Key_2024!@#$%^&*()";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "TaoyuanDMS",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "TaoyuanDMS",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// Connection string
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Server=localhost;Database=TaoyuanDMS;Trusted_Connection=True;TrustServerCertificate=True;";

// Register services (Dapper-based)
builder.Services.AddSingleton(new DbConnectionFactory(connectionString));
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<UserService>();
builder.Services.AddScoped<FileService>();
builder.Services.AddScoped<TrashService>();
builder.Services.AddScoped<AuditService>();
builder.Services.AddScoped<PermissionService>();
builder.Services.AddScoped<EditLockService>();
builder.Services.AddScoped<StorageService>();
builder.Services.AddScoped<SectionService>();
builder.Services.AddScoped<ShareService>();
// CORS — 雙站台架構，需指定前端來源
var allowedOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "https://localhost:7443")
    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

var app = builder.Build();

// 啟動時一次性建立系統資料夾（替代每次請求動態建立）
using (var scope = app.Services.CreateScope())
{
    try
    {
        var fileSvc = scope.ServiceProvider.GetRequiredService<FileService>();
        await fileSvc.EnsureSystemFoldersAsync(force: true);
        Console.WriteLine("[Startup] 系統資料夾初始化完成");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[Startup] 系統資料夾初始化失敗：{ex.Message}");
    }
}

// 全域錯誤處理：統一以 JSON 回傳 { code, message, traceId }
app.Use(async (context, next) =>
{
    try
    {
        await next();
    }
    catch (Exception ex)
    {
        var traceId = context.TraceIdentifier;
        Console.Error.WriteLine($"[Error {traceId}] {ex}");

        var status = ex switch
        {
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            KeyNotFoundException or FileNotFoundException => StatusCodes.Status404NotFound,
            InvalidOperationException or ArgumentException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };

        if (!context.Response.HasStarted)
        {
            context.Response.Clear();
            context.Response.StatusCode = status;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                code = status,
                message = ex.Message,
                traceId
            });
        }
    }
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// SPA fallback
app.MapFallbackToFile("index.html");

app.Run();
