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
public interface ITokenService
{
    string Create(AppUser user);
}

public class TokenService(IConfiguration c) : ITokenService
{
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

public interface IAuthService
{
    Task<AuthResponse> Register(RegisterRequest r);
    Task<AuthResponse> Login(LoginRequest r);
}

public class AuthService(AppDbContext db, IPasswordHasher<AppUser> h, ITokenService t, INeonObjectStorage storage) : IAuthService
{
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

    public async Task<AuthResponse> Login(LoginRequest r)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        var u = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (u is null || h.VerifyHashedPassword(u, u.PasswordHash, r.Password) != PasswordVerificationResult.Success)
            throw new UnauthorizedAccessException("Invalid email or password.");
        return new(new(u.Id, u.Email, u.DisplayName, u.TimeZoneId, string.IsNullOrWhiteSpace(u.ProfileImageUrl) ? null : storage.GetReadUrl("users", u.ProfileImageUrl)), t.Create(u));
    }
}
