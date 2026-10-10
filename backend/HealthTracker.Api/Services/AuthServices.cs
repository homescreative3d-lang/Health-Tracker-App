using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace HealthTracker.Api.Services;
/// <summary>
/// Issues signed JWT access tokens.
/// </summary>
public interface ITokenService
{
    /// <summary>
    /// Creates an 8-hour JWT carrying the user's id, email and name.
    /// </summary>
    /// <param name="user">The authenticated user.</param>
    string Create(AppUser user);
}

/// <summary>
/// HMAC-SHA256 JWT issuer configured by <c>Jwt:Key</c>, <c>Jwt:Issuer</c> and <c>Jwt:Audience</c>.
/// </summary>
/// <param name="c">Application configuration.</param>
public class TokenService(IConfiguration c) : ITokenService
{
    /// <inheritdoc />
    public string Create(AppUser u)
    {
        var key = c["Jwt:Key"] ?? throw new InvalidOperationException("Jwt:Key is missing");
        var creds = new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)), SecurityAlgorithms.HmacSha256);
        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, u.Id.ToString()),
            new Claim(ClaimTypes.NameIdentifier, u.Id.ToString()),
            new Claim(ClaimTypes.Email, u.Email),
            new Claim(ClaimTypes.Name, u.DisplayName)
        };
        return new JwtSecurityTokenHandler().WriteToken(new JwtSecurityToken(c["Jwt:Issuer"] ?? "HealthTracker", c["Jwt:Audience"] ?? "HealthTrackerWeb", claims, expires: DateTime.UtcNow.AddHours(8), signingCredentials: creds));
    }
}

/// <summary>
/// Account registration and credential verification.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Creates a user (and an empty patient record for onboarding) and returns a session.
    /// </summary>
    /// <param name="r">Registration details.</param>
    /// <exception cref="InvalidOperationException">Email taken or input invalid.</exception>
    Task<AuthResponse> Register(RegisterRequest r);

    /// <summary>
    /// Verifies credentials and returns a session.
    /// </summary>
    /// <param name="r">Credentials.</param>
    /// <exception cref="UnauthorizedAccessException">Email or password is wrong.</exception>
    Task<AuthResponse> Login(LoginRequest r);
}

/// <summary>
/// EF Core implementation of <see cref="IAuthService"/> using ASP.NET Core Identity password hashing.
/// </summary>
public class AuthService(AppDbContext db, IPasswordHasher<AppUser> h, ITokenService t, INeonObjectStorage storage) : IAuthService
{
    /// <inheritdoc />
    public async Task<AuthResponse> Register(RegisterRequest r)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        if (await db.Users.AnyAsync(x => x.Email == email))
            throw new InvalidOperationException("An account with this email already exists.");
        if (r.Password.Length < 8)
            throw new InvalidOperationException("Password must be at least 8 characters.");
        if (r.DisplayName.Trim().Length < 2)
            throw new InvalidOperationException("Name is required.");
        var u = new AppUser
        {
            Email = email,
            DisplayName = r.DisplayName.Trim()
        };
        u.PasswordHash = h.HashPassword(u, r.Password);
        db.Users.Add(u);
        db.Patients.Add(new Patient { UserId = u.Id });
        await db.SaveChangesAsync();
        return new(new(u.Id, u.Email, u.DisplayName, u.TimeZoneId, string.IsNullOrWhiteSpace(u.ProfileImageUrl) ? null : storage.GetReadUrl("users", u.ProfileImageUrl)), t.Create(u));
    }

    /// <inheritdoc />
    public async Task<AuthResponse> Login(LoginRequest r)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        var u = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (u is null || h.VerifyHashedPassword(u, u.PasswordHash, r.Password) != PasswordVerificationResult.Success)
            throw new UnauthorizedAccessException("Invalid email or password.");
        return new(new(u.Id, u.Email, u.DisplayName, u.TimeZoneId, string.IsNullOrWhiteSpace(u.ProfileImageUrl) ? null : storage.GetReadUrl("users", u.ProfileImageUrl)), t.Create(u));
    }
}
