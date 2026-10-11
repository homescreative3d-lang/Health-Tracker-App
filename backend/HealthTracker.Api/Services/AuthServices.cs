using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Domain;
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

    /// <summary>
    /// Builds the public user shape, including patient-portal status (linked patient ids and
    /// whether the user may mark their own doses).
    /// </summary>
    Task<UserResponse> ToResponse(AppUser u);
}

/// <summary>
/// EF Core implementation of <see cref="IAuthService"/> using ASP.NET Core Identity password hashing.
/// </summary>
public class AuthService(AppDbContext db, IPasswordHasher<AppUser> h, ITokenService t, INeonObjectStorage storage, IPatientLinker linker) : IAuthService
{
    /// <inheritdoc />
    public async Task<AuthResponse> Register(RegisterRequest r)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        if (r.Password.Length < 8)
            throw new InvalidOperationException("Password must be at least 8 characters.");
        if (r.DisplayName.Trim().Length < 2)
            throw new InvalidOperationException("Name is required.");
        string phone;
        try
        {
            phone = PhoneNumber.Normalize(r.Phone);
        }
        catch (ArgumentException e)
        {
            throw new InvalidOperationException(e.Message);
        }

        var existing = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        AppUser u;
        if (existing is { IsDeleted: true })
        {
            // Soft-deleted account: signing up again with the same email reactivates it.
            u = existing;
            u.IsDeleted = false;
            u.DeletedAt = null;
            u.DisplayName = r.DisplayName.Trim();
            u.Phone = phone;
            u.PasswordHash = h.HashPassword(u, r.Password);
            if (!await db.Patients.AnyAsync(p => p.UserId == u.Id))
                db.Patients.Add(new Patient { UserId = u.Id });
        }
        else if (existing is not null)
        {
            throw new InvalidOperationException("An account with this email already exists.");
        }
        else
        {
            u = new AppUser { Email = email, DisplayName = r.DisplayName.Trim(), Phone = phone };
            u.PasswordHash = h.HashPassword(u, r.Password);
            db.Users.Add(u);
            db.Patients.Add(new Patient { UserId = u.Id });
        }

        await db.SaveChangesAsync();
        await linker.LinkByEmailAsync(u);
        return new(await ToResponse(u), t.Create(u));
    }

    /// <inheritdoc />
    public async Task<AuthResponse> Login(LoginRequest r)
    {
        var email = r.Email.Trim().ToLowerInvariant();
        var u = await db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (u is null || u.IsDeleted || h.VerifyHashedPassword(u, u.PasswordHash, r.Password) != PasswordVerificationResult.Success)
            throw new UnauthorizedAccessException("Invalid email or password.");
        await linker.LinkByEmailAsync(u);
        return new(await ToResponse(u), t.Create(u));
    }

    /// <inheritdoc />
    public async Task<UserResponse> ToResponse(AppUser u)
    {
        var linked = await db.Patients.Where(p => p.LinkedUserId == u.Id).Select(p => new { p.Id, p.CanMarkOwnDoses }).ToListAsync();
        return new UserResponse(u.Id, u.Email, u.DisplayName, u.TimeZoneId,
            string.IsNullOrWhiteSpace(u.ProfileImageUrl) ? null : storage.GetReadUrl("users", u.ProfileImageUrl),
            u.Phone, linked.Count > 0, linked.Select(x => x.Id).ToList(), linked.Any(x => x.CanMarkOwnDoses));
    }
}
