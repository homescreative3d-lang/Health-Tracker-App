using System.Text.Json;
using HealthTracker.Api.Contracts;
using HealthTracker.Api.Data;
using HealthTracker.Api.Models;
using HealthTracker.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace HealthTracker.Api.Controllers;
/// <summary>
/// Family groups: sharing patients with other registered users after they consent.
/// </summary>
/// <remarks>
/// A user can belong to one family. Only the family owner can invite. Invitees get an in-app
/// notification (and Web Push when enabled) and gain access to every member's patients once they
/// accept. Not yet supported: removing members, cancelling invitations and leaving a family.
/// </remarks>
[Authorize]
[Route("api/family")]
public class FamilyController(AppDbContext db, IPushNotificationService push, INeonObjectStorage storage) : ApiControllerBase
{
    Guid U => CurrentUserId;

    /// <summary>Returns a signed URL for a stored profile image key, or null.</summary>
    string? Photo(string? key) => string.IsNullOrWhiteSpace(key) ? null : storage.GetReadUrl("users", key);

    /// <summary>
    /// Finds registered users by partial name or email (case-insensitive, max 20).
    /// </summary>
    /// <param name="q">Search text, at least 2 characters.</param>
    /// <response code="200">Matching users, excluding the caller.</response>
    [HttpGet("search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Search([FromQuery] string q = "")
    {
        q = q.Trim();
        if (q.Length < 2)
            return Ok(Array.Empty<object>());
        return Ok((await db.Users.Where(x => x.Id != U && (EF.Functions.ILike(x.Email, "%" + q + "%") || EF.Functions.ILike(x.DisplayName, "%" + q + "%"))).OrderBy(x => x.DisplayName).Take(20).Select(x => new { x.Id, x.Email, x.DisplayName, x.ProfileImageUrl }).ToListAsync()).Select(x => new { x.Id, x.Email, x.DisplayName, ProfileImageUrl = Photo(x.ProfileImageUrl) }));
    }

    /// <summary>
    /// Lists the user's latest 50 notifications.
    /// </summary>
    /// <remarks>Legacy duplicate of <c>GET /api/notifications</c>, kept for older clients.</remarks>
    /// <response code="200">Notifications, newest first.</response>
    [HttpGet("notifications")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Notifications() => Ok(await db.Notifications.Where(x => x.UserId == U).OrderByDescending(x => x.CreatedAt).Take(50).Select(x => new { x.Id, x.Type, x.Title, x.Message, x.DataJson, x.IsRead, x.CreatedAt }).ToListAsync());
    /// <summary>
    /// Marks a notification read.
    /// </summary>
    /// <remarks>Legacy duplicate of <c>POST /api/notifications/{id}/read</c>.</remarks>
    /// <param name="id">Notification id.</param>
    /// <response code="200">Updated notification.</response>
    /// <response code="404">Not found.</response>
    [HttpPost("notifications/{id:guid}/read")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Read(Guid id)
    {
        var n = await db.Notifications.SingleOrDefaultAsync(x => x.Id == id && x.UserId == U);
        if (n is null)
            return NotFound();
        n.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(n);
    }

    /// <summary>
    /// Creates a family owned by the user.
    /// </summary>
    /// <param name="r">Family name.</param>
    /// <response code="200">The new family.</response>
    /// <response code="400">Name missing.</response>
    /// <response code="409">The user already belongs to a family.</response>
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(FamilyCreateRequest r)
    {
        if (string.IsNullOrWhiteSpace(r.Name))
            return BadRequest(new { message = "Family name is required." });
        if (await db.FamilyMembers.AnyAsync(x => x.UserId == U && x.Status == "approved"))
            return Conflict(new { message = "You are already in a family." });
        var f = new Family
        {
            Name = r.Name.Trim(),
            OwnerUserId = U
        };
        db.Families.Add(f);
        db.FamilyMembers.Add(new FamilyMember { FamilyId = f.Id, UserId = U });
        await db.SaveChangesAsync();
        return Ok(new { f.Id, f.Name });
    }

    /// <summary>
    /// Invites a registered user to the caller's family (owner only).
    /// </summary>
    /// <param name="r">User to invite.</param>
    /// <response code="200">Invitation created; access starts after the invitee accepts.</response>
    /// <response code="400">The caller doesn't own a family.</response>
    /// <response code="404">User not found.</response>
    /// <response code="409">Already a member, or an invitation is pending.</response>
    [HttpPost("invite")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Invite(FamilyInviteRequest r)
    {
        var f = await db.Families.SingleOrDefaultAsync(x => x.OwnerUserId == U);
        if (f is null)
            return BadRequest(new { message = "Create a family first." });
        var target = await db.Users.FindAsync(r.UserId);
        if (target is null || target.Id == U)
            return NotFound(new { message = "User not found." });
        if (await db.FamilyMembers.AnyAsync(x => x.FamilyId == f.Id && x.UserId == target.Id && x.Status == "approved"))
            return Conflict(new { message = "User already belongs to this family." });
        if (await db.FamilyInvites.AnyAsync(x => x.FamilyId == f.Id && x.InviteeUserId == target.Id && x.Status == "pending"))
            return Conflict(new { message = "Invitation already pending." });
        var inv = new FamilyInvite
        {
            FamilyId = f.Id,
            InviterUserId = U,
            InviteeUserId = target.Id
        };
        db.FamilyInvites.Add(inv);
        var me = await db.Users.FindAsync(U);
        var title = "Family invitation";
        var message = $"{me?.DisplayName ?? "A user"} invited you to join {f.Name}.";
        db.Notifications.Add(new AppNotification { UserId = target.Id, Type = "family_invite", Title = title, Message = message, DataJson = JsonSerializer.Serialize(new { inviteId = inv.Id, familyId = f.Id }) });
        await db.SaveChangesAsync();
        // The in-app notification is always persisted; Web Push is best-effort for devices
        // where the invitee has enabled browser notifications.
        await push.SendToUsersAsync([target.Id], title, message, "family_invite", null);
        return Ok(new { inv.Id, Status = inv.Status, Invitee = new { target.Id, target.Email, target.DisplayName, ProfileImageUrl = Photo(target.ProfileImageUrl) } });
    }

    /// <summary>
    /// Accepts or declines an invitation addressed to the user.
    /// </summary>
    /// <param name="id">Invitation id (from the notification's <c>dataJson.inviteId</c>).</param>
    /// <param name="r">True to accept.</param>
    /// <response code="200">New invitation status.</response>
    /// <response code="404">Invitation not found.</response>
    /// <response code="409">Already answered.</response>
    [HttpPost("invites/{id:guid}/respond")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Respond(Guid id, FamilyInviteResponse r)
    {
        var inv = await db.FamilyInvites.SingleOrDefaultAsync(x => x.Id == id && x.InviteeUserId == U);
        if (inv is null)
            return NotFound();
        if (inv.Status != "pending")
            return Conflict(new { message = "Invitation already handled." });
        inv.Status = r.Accept ? "approved" : "rejected";
        if (r.Accept)
            db.FamilyMembers.Add(new FamilyMember { FamilyId = inv.FamilyId, UserId = U });
        var n = await db.Notifications.Where(x => x.UserId == U && x.DataJson.Contains(id.ToString())).FirstOrDefaultAsync();
        if (n is not null)
            n.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(new { status = inv.Status });
    }

    /// <summary>
    /// Returns the user's family with approved members and invitations the user sent.
    /// </summary>
    /// <response code="200">Zero or one family.</response>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get()
    {
        var ids = await db.FamilyMembers.Where(x => x.UserId == U && x.Status == "approved").Select(x => x.FamilyId).ToListAsync();
        var fams = await db.Families.Where(x => ids.Contains(x.Id)).ToListAsync();
        var members = await db.FamilyMembers.Where(x => ids.Contains(x.FamilyId) && x.Status == "approved").ToListAsync();
        var users = await db.Users.Where(x => members.Select(m => m.UserId).Contains(x.Id)).ToListAsync();
        var pending = await db.FamilyInvites.Where(x => x.InviterUserId == U && x.Status == "pending").ToListAsync();
        var pendingUserIds = pending.Select(x => x.InviteeUserId).Distinct().ToList();
        var pendingUsers = await db.Users.Where(x => pendingUserIds.Contains(x.Id)).ToListAsync();
        return Ok(fams.Select(f => new
        {
            f.Id,
            f.Name,
            Members = members.Where(m => m.FamilyId == f.Id).Select(m =>
        {
            var u = users.First(z => z.Id == m.UserId);
            return new
            {
                m.Id,
                UserId = u.Id,
                u.Email,
                u.DisplayName,
                ProfileImageUrl = Photo(u.ProfileImageUrl)
            };
        }),
            Pending = pending.Where(i => i.FamilyId == f.Id).Select(i =>
        {
            var u = pendingUsers.FirstOrDefault(z => z.Id == i.InviteeUserId);
            return new
            {
                i.Id,
                InviteeUserId = i.InviteeUserId,
                InviteeEmail = u?.Email,
                InviteeDisplayName = u?.DisplayName,
                InviteeProfileImageUrl = Photo(u?.ProfileImageUrl),
                i.Status
            };
        })
        }));
    }
}
