using System.Security.Cryptography;
using System.Text;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;
/// <summary>
/// Password reset by email link.
/// </summary>
[Route("api/password")]
public class PasswordController(
    AppDbContext db,
    IPasswordHasher<AppUser> hasher,
    IConfiguration config,
    IWebHostEnvironment env,
    ILogger<PasswordController> log) : ApiControllerBase
{
    /// <summary>
    /// Emails a password-reset link valid for 30 minutes.
    /// </summary>
    /// <remarks>Always returns 200 so the endpoint can't be used to discover which emails are registered.</remarks>
    /// <param name="r">The account email.</param>
    /// <response code="200">Request accepted.</response>
    [HttpPost("forgot")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Forgot(ForgotPasswordRequest r)
    {
        var u = await db.Users.SingleOrDefaultAsync(x => x.Email == r.Email.Trim().ToLowerInvariant());
        if (u is not null)
        {
            var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            db.PasswordResetTokens.Add(new PasswordResetToken { UserId = u.Id, TokenHash = Hash(raw), ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(30) });
            await db.SaveChangesAsync();
            var url = (config["Frontend:Url"] ?? "https://healthsteady.netlify.app") + "/reset-password?reset=" + Uri.EscapeDataString(raw);
            await SendEmail(u.Email, url);
        }

        return Ok(new { message = "If an account exists for this email, reset instructions have been sent." });
    }

    /// <summary>
    /// Sets a new password using the token from the reset link (single use).
    /// </summary>
    /// <param name="r">Token and new password (min 8 characters).</param>
    /// <response code="200">Password changed.</response>
    /// <response code="400">Password too short, or link invalid/expired.</response>
    [HttpPost("reset")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Reset(ResetPasswordRequest r)
    {
        if (r.NewPassword.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters." });
        var token = await db.PasswordResetTokens.SingleOrDefaultAsync(x => x.TokenHash == Hash(r.Token) && !x.Used && x.ExpiresAt > DateTimeOffset.UtcNow);
        if (token is null)
            return BadRequest(new { message = "Reset link is invalid or expired." });
        var u = await db.Users.FindAsync(token.UserId);
        if (u is null)
            return BadRequest(new { message = "Account not found." });
        u.PasswordHash = hasher.HashPassword(u, r.NewPassword);
        token.Used = true;
        await db.SaveChangesAsync();
        return Ok(new { message = "Password updated." });
    }

    /// <summary>SHA-256 hex hash; only hashes of reset tokens are stored.</summary>
    /// <param name="v">Raw token.</param>
    static string Hash(string v) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(v)));
    /// <summary>
    /// Sends the reset email via SMTP. When SMTP isn't configured, the link is logged only in
    /// Development: previously it was logged in every environment, which put live reset tokens
    /// for real accounts into production logs.
    /// </summary>
    /// <param name="to">Recipient.</param>
    /// <param name="url">Reset link.</param>
    async Task SendEmail(string to, string url)
    {
        var host = config["Smtp:Host"];
        if (string.IsNullOrWhiteSpace(host))
        {
            if (env.IsDevelopment())
                log.LogWarning("SMTP not configured; development reset URL: {Url}", url);
            else
                log.LogError("SMTP is not configured; a password reset email could not be sent.");
            return;
        }

        using var client = new System.Net.Mail.SmtpClient(host, int.TryParse(config["Smtp:Port"], out var port) ? port : 587)
        {
            EnableSsl = true,
            Credentials = new System.Net.NetworkCredential(config["Smtp:Username"], config["Smtp:Password"])
        };
        using var msg = new System.Net.Mail.MailMessage(config["Smtp:From"] ?? config["Smtp:Username"]!, to, "Tended password reset", $"Reset your password: {url}\nThis link expires in 30 minutes.");
        await client.SendMailAsync(msg);
    }
}
