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
/// <list type="bullet">
/// <item>A user belongs to at most one family.</item>
/// <item>The creator is the family's <b>admin</b>. Only the admin, or members the admin grants
/// <c>canManageMembers</c>, can invite/remove people, cancel invitations and edit the family.</item>
/// <item>Only the admin can grant/revoke that right or hand over the admin role.</item>
/// <item>Invitees accept or decline; the inviter and admin are notified either way.</item>
/// <item>Every change is posted as an in-app notification and sent as Web Push.</item>
/// </list>
/// </remarks>
[Authorize]
[Route("api/family")]
public class FamilyController(AppDbContext db, IPushNotificationService push, INeonObjectStorage storage) : ApiControllerBase
{
    Guid U => CurrentUserId;

    /// <summary>Returns a signed URL for a stored image key, or null.</summary>
    string? Photo(string? key) => string.IsNullOrWhiteSpace(key) ? null : storage.GetReadUrl("users", key);

    /// <summary>The caller's approved membership (null when not in a family).</summary>
    Task<FamilyMember?> MyMembership() =>
        db.FamilyMembers.FirstOrDefaultAsync(m => m.UserId == U && m.Status == "approved");

    /// <summary>True for the admin or a member granted the manage right.</summary>
    static bool CanManage(FamilyMember? m) => m is not null && (m.Role == "admin" || m.CanManageMembers);

    /// <summary>Display name of a user (falls back to "Someone").</summary>
    async Task<string> NameOf(Guid userId) => (await db.Users.FindAsync(userId))?.DisplayName ?? "Someone";

    /// <summary>
    /// Stores an in-app notification for each recipient (excluding the caller) and sends Web Push.
    /// </summary>
    async Task Notify(IEnumerable<Guid> userIds, string type, string title, string message, object data)
    {
        var recipients = userIds.Where(id => id != U).Distinct().ToList();
        if (recipients.Count == 0)
            return;
        var payload = JsonSerializer.Serialize(data);
        foreach (var id in recipients)
            db.Notifications.Add(new AppNotification { UserId = id, Type = type, Title = title, Message = message, DataJson = payload });
        await db.SaveChangesAsync();
        await push.SendToUsersAsync(recipients, title, message, type, null);
    }

    /// <summary>User ids of all approved members of a family.</summary>
    Task<List<Guid>> MemberIds(Guid familyId) =>
        db.FamilyMembers.Where(m => m.FamilyId == familyId && m.Status == "approved").Select(m => m.UserId).ToListAsync();

    /// <summary>User ids of the family's admin and members with the manage right.</summary>
    Task<List<Guid>> ManagerIds(Guid familyId) =>
        db.FamilyMembers.Where(m => m.FamilyId == familyId && m.Status == "approved" && (m.Role == "admin" || m.CanManageMembers))
            .Select(m => m.UserId).ToListAsync();

    /// <summary>
    /// Finds registered users by partial name or email (case-insensitive, max 20).
    /// </summary>
    /// <remarks>Each result says whether the user is already in a family (they can't be invited).</remarks>
    /// <param name="q">Search text, at least 2 characters.</param>
    /// <response code="200">Matching users, excluding the caller.</response>
    [HttpGet("search")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Search([FromQuery] string q = "")
    {
        q = q.Trim();
        if (q.Length < 2)
            return Ok(Array.Empty<object>());
        var users = await db.Users
            .Where(x => x.Id != U && (EF.Functions.ILike(x.Email, "%" + q + "%") || EF.Functions.ILike(x.DisplayName, "%" + q + "%")))
            .OrderBy(x => x.DisplayName).Take(20)
            .Select(x => new { x.Id, x.Email, x.DisplayName, x.ProfileImageUrl })
            .ToListAsync();
        var ids = users.Select(u => u.Id).ToList();
        var inFamily = await db.FamilyMembers.Where(m => ids.Contains(m.UserId) && m.Status == "approved").Select(m => m.UserId).ToListAsync();
        return Ok(users.Select(x => new { x.Id, x.Email, x.DisplayName, ProfileImageUrl = Photo(x.ProfileImageUrl), InFamily = inFamily.Contains(x.Id) }));
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
    /// Creates a family; the caller becomes its admin.
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
        if (string.IsNullOrWhiteSpace(r.Name) || r.Name.Trim().Length > 80)
            return BadRequestMessage("Enter a family name (up to 80 characters).");
        if (await MyMembership() is not null)
            return Conflict(new { message = "You are already in a family. A person can belong to one family only." });
        var f = new Family { Name = r.Name.Trim(), OwnerUserId = U };
        db.Families.Add(f);
        db.FamilyMembers.Add(new FamilyMember { FamilyId = f.Id, UserId = U, Role = "admin" });
        // Joining a family elsewhere is no longer possible: withdraw invitations addressed to this user.
        foreach (var inv in await db.FamilyInvites.Where(i => i.InviteeUserId == U && i.Status == "pending").ToListAsync())
            inv.Status = "expired";
        await db.SaveChangesAsync();
        return Ok(new { f.Id, f.Name });
    }

    /// <summary>
    /// Renames the family and/or changes its picture (admin or members with the manage right).
    /// </summary>
    /// <param name="r">Name, and <c>photoUrl</c>: a <c>data:image/...</c> URL to upload (max 1 MB), empty to remove, or the current URL to keep.</param>
    /// <response code="200">Updated family summary.</response>
    /// <response code="400">Invalid name or image.</response>
    /// <response code="403">The caller may not edit this family.</response>
    [HttpPut]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Update(FamilyUpdateRequest r)
    {
        var me = await MyMembership();
        if (!CanManage(me))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the family admin, or members they allow, can edit the family." });
        if (string.IsNullOrWhiteSpace(r.Name) || r.Name.Trim().Length > 80)
            return BadRequestMessage("Enter a family name (up to 80 characters).");
        var f = await db.Families.FindAsync(me!.FamilyId);
        if (f is null)
            return NotFound();
        f.Name = r.Name.Trim();
        var old = f.PhotoKey;
        if (!string.IsNullOrWhiteSpace(r.PhotoUrl) && r.PhotoUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            f.PhotoKey = await storage.PutDataUrlAsync("users", $"families/{f.Id}/{Guid.NewGuid():N}", r.PhotoUrl);
        else if (string.IsNullOrWhiteSpace(r.PhotoUrl))
            f.PhotoKey = null;
        if (f.PhotoKey != old && !string.IsNullOrWhiteSpace(old))
            await storage.DeleteAsync("users", old);
        await db.SaveChangesAsync();
        await Notify(await MemberIds(f.Id), "family_updated", "Family updated", $"{await NameOf(U)} updated the family details for {f.Name}.", new { familyId = f.Id });
        return Ok(new { f.Id, f.Name, PhotoUrl = Photo(f.PhotoKey) });
    }

    /// <summary>
    /// Invites a registered user (admin or members with the manage right).
    /// </summary>
    /// <param name="r">User to invite.</param>
    /// <response code="200">Invitation created; access starts after the invitee accepts.</response>
    /// <response code="400">The caller isn't in a family.</response>
    /// <response code="403">The caller may not add members.</response>
    /// <response code="404">User not found.</response>
    /// <response code="409">Already in a family, or an invitation is pending.</response>
    [HttpPost("invite")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Invite(FamilyInviteRequest r)
    {
        var me = await MyMembership();
        if (me is null)
            return BadRequestMessage("Create a family first.");
        if (!CanManage(me))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the family admin, or members they allow, can add people." });
        var f = await db.Families.FindAsync(me.FamilyId);
        var target = await db.Users.FindAsync(r.UserId);
        if (f is null || target is null || target.Id == U)
            return NotFound(new { message = "User not found." });
        if (await db.FamilyMembers.AnyAsync(x => x.UserId == target.Id && x.Status == "approved"))
            return Conflict(new { message = $"{target.DisplayName} already belongs to a family." });
        if (await db.FamilyInvites.AnyAsync(x => x.FamilyId == f.Id && x.InviteeUserId == target.Id && x.Status == "pending"))
            return Conflict(new { message = "An invitation is already waiting for their answer." });
        var inv = new FamilyInvite { FamilyId = f.Id, InviterUserId = U, InviteeUserId = target.Id };
        db.FamilyInvites.Add(inv);
        await db.SaveChangesAsync();
        var inviter = await NameOf(U);
        await Notify([target.Id], "family_invite", "Family invitation",
            $"{inviter} invited you to join {f.Name}. Accept to share medicine plans with this family.",
            new { inviteId = inv.Id, familyId = f.Id, familyName = f.Name, inviterName = inviter });
        return Ok(new { inv.Id, Status = inv.Status, Invitee = new { target.Id, target.Email, target.DisplayName, ProfileImageUrl = Photo(target.ProfileImageUrl) } });
    }

    /// <summary>
    /// Accepts or declines an invitation addressed to the caller.
    /// </summary>
    /// <remarks>The inviter and the family's managers are notified of the answer; on accept, all members are told who joined.</remarks>
    /// <param name="id">Invitation id (from the notification's <c>dataJson.inviteId</c>).</param>
    /// <param name="r">True to accept.</param>
    /// <response code="200">New invitation status.</response>
    /// <response code="404">Invitation not found.</response>
    /// <response code="409">Already answered/withdrawn, or the caller is already in a family.</response>
    [HttpPost("invites/{id:guid}/respond")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Respond(Guid id, FamilyInviteResponse r)
    {
        var inv = await db.FamilyInvites.SingleOrDefaultAsync(x => x.Id == id && x.InviteeUserId == U);
        if (inv is null)
            return NotFound(new { message = "Invitation not found." });
        if (inv.Status != "pending")
            return Conflict(new { message = inv.Status is "cancelled" or "expired" ? "This invitation was withdrawn." : "You already answered this invitation." });
        if (r.Accept && await MyMembership() is not null)
            return Conflict(new { message = "You're already in a family. Leave it before joining another." });
        var f = await db.Families.FindAsync(inv.FamilyId);
        if (f is null)
            return Conflict(new { message = "This family no longer exists." });

        inv.Status = r.Accept ? "approved" : "rejected";
        if (r.Accept)
        {
            db.FamilyMembers.Add(new FamilyMember { FamilyId = inv.FamilyId, UserId = U, Role = "member" });
            foreach (var other in await db.FamilyInvites.Where(i => i.InviteeUserId == U && i.Status == "pending" && i.Id != id).ToListAsync())
                other.Status = "expired";
        }
        foreach (var n in await db.Notifications.Where(x => x.UserId == U && x.Type == "family_invite" && x.DataJson.Contains(id.ToString())).ToListAsync())
            n.IsRead = true;
        await db.SaveChangesAsync();

        var me = await NameOf(U);
        var reviewers = (await ManagerIds(f.Id)).Append(inv.InviterUserId).ToList();
        await Notify(reviewers, "family_invite_response", r.Accept ? "Invitation accepted" : "Invitation declined",
            r.Accept ? $"{me} accepted the invitation and joined {f.Name}." : $"{me} declined the invitation to join {f.Name}.",
            new { inviteId = inv.Id, familyId = f.Id, accepted = r.Accept, userId = U });
        if (r.Accept)
        {
            var others = (await MemberIds(f.Id)).Except(reviewers).ToList();
            await Notify(others, "family_member_joined", "New family member", $"{me} joined {f.Name}.", new { familyId = f.Id, userId = U });
        }

        return Ok(new { status = inv.Status });
    }

    /// <summary>
    /// Withdraws a pending invitation (admin or members with the manage right).
    /// </summary>
    /// <param name="id">Invitation id.</param>
    /// <response code="204">Withdrawn.</response>
    /// <response code="403">Not allowed.</response>
    /// <response code="404">Not found or no longer pending.</response>
    [HttpDelete("invites/{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> CancelInvite(Guid id)
    {
        var me = await MyMembership();
        if (!CanManage(me))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the family admin, or members they allow, can withdraw invitations." });
        var inv = await db.FamilyInvites.SingleOrDefaultAsync(i => i.Id == id && i.FamilyId == me!.FamilyId && i.Status == "pending");
        if (inv is null)
            return NotFound(new { message = "Invitation not found." });
        inv.Status = "cancelled";
        foreach (var n in await db.Notifications.Where(x => x.UserId == inv.InviteeUserId && x.Type == "family_invite" && x.DataJson.Contains(id.ToString())).ToListAsync())
            n.IsRead = true;
        await db.SaveChangesAsync();
        var f = await db.Families.FindAsync(inv.FamilyId);
        await Notify([inv.InviteeUserId], "family_invite_cancelled", "Invitation withdrawn", $"The invitation to join {f?.Name} was withdrawn.", new { inviteId = id });
        return NoContent();
    }

    /// <summary>
    /// Removes a member (admin, or members with the manage right; only the admin can remove a manager-admin).
    /// </summary>
    /// <param name="userId">Member's user id.</param>
    /// <response code="204">Removed; their access to the family's patients ends immediately.</response>
    /// <response code="400">Use leave to remove yourself; the admin can't be removed.</response>
    /// <response code="403">Not allowed.</response>
    /// <response code="404">Not a member.</response>
    [HttpDelete("members/{userId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveMember(Guid userId)
    {
        var me = await MyMembership();
        if (!CanManage(me))
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the family admin, or members they allow, can remove people." });
        if (userId == U)
            return BadRequestMessage("To remove yourself, use Leave family.");
        var target = await db.FamilyMembers.FirstOrDefaultAsync(m => m.FamilyId == me!.FamilyId && m.UserId == userId && m.Status == "approved");
        if (target is null)
            return NotFound(new { message = "That person isn't in your family." });
        if (target.Role == "admin")
            return BadRequestMessage("The admin can't be removed. The admin can hand over the role first.");
        if (target.CanManageMembers && me!.Role != "admin")
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the admin can remove a member who manages the family." });
        db.FamilyMembers.Remove(target);
        await db.SaveChangesAsync();
        var f = await db.Families.FindAsync(me!.FamilyId);
        var name = await NameOf(userId);
        await Notify([userId], "family_member_removed", "Removed from family", $"You were removed from {f?.Name}.", new { familyId = f?.Id });
        await Notify(await ManagerIds(me.FamilyId), "family_member_removed", "Member removed", $"{await NameOf(U)} removed {name} from {f?.Name}.", new { familyId = f?.Id, userId });
        return NoContent();
    }

    /// <summary>
    /// Grants or revokes a member's right to add/remove members and edit the family (admin only).
    /// </summary>
    /// <param name="userId">Member's user id.</param>
    /// <param name="r">Whether the member may manage the family.</param>
    /// <response code="200">Updated member.</response>
    /// <response code="403">Only the admin can change rights.</response>
    /// <response code="404">Not a member.</response>
    [HttpPut("members/{userId:guid}/permissions")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetPermissions(Guid userId, FamilyPermissionRequest r)
    {
        var me = await MyMembership();
        if (me?.Role != "admin")
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the family admin can change who manages the family." });
        var target = await db.FamilyMembers.FirstOrDefaultAsync(m => m.FamilyId == me.FamilyId && m.UserId == userId && m.Status == "approved" && m.Role != "admin");
        if (target is null)
            return NotFound(new { message = "That person isn't a member of your family." });
        target.CanManageMembers = r.CanManageMembers;
        await db.SaveChangesAsync();
        var f = await db.Families.FindAsync(me.FamilyId);
        await Notify([userId], "family_role_changed", r.CanManageMembers ? "You can now manage the family" : "Family rights changed",
            r.CanManageMembers ? $"You can now add and remove members of {f?.Name}." : $"You can no longer add or remove members of {f?.Name}.",
            new { familyId = f?.Id, canManageMembers = r.CanManageMembers });
        return Ok(new { userId, target.Role, target.CanManageMembers });
    }

    /// <summary>
    /// Hands the admin role to another member (admin only); the previous admin becomes a member.
    /// </summary>
    /// <param name="userId">New admin's user id.</param>
    /// <response code="204">Role transferred.</response>
    /// <response code="403">Only the admin can transfer the role.</response>
    /// <response code="404">Not a member.</response>
    [HttpPost("members/{userId:guid}/make-admin")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> MakeAdmin(Guid userId)
    {
        var me = await MyMembership();
        if (me?.Role != "admin")
            return StatusCode(StatusCodes.Status403Forbidden, new { message = "Only the family admin can hand over the admin role." });
        var target = await db.FamilyMembers.FirstOrDefaultAsync(m => m.FamilyId == me.FamilyId && m.UserId == userId && m.Status == "approved");
        if (target is null || userId == U)
            return NotFound(new { message = "Choose another member of your family." });
        var f = await db.Families.FindAsync(me.FamilyId);
        target.Role = "admin";
        target.CanManageMembers = false;
        me.Role = "member";
        me.CanManageMembers = true;
        if (f is not null)
            f.OwnerUserId = userId;
        await db.SaveChangesAsync();
        await Notify(await MemberIds(me.FamilyId), "family_role_changed", "New family admin", $"{await NameOf(userId)} is now the admin of {f?.Name}.", new { familyId = f?.Id, userId });
        return NoContent();
    }

    /// <summary>
    /// Leaves the family. The admin must hand over the role first, unless they are the last member
    /// (the family is then deleted).
    /// </summary>
    /// <response code="204">Left (or family deleted).</response>
    /// <response code="400">Admin with other members, or not in a family.</response>
    [HttpPost("leave")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Leave()
    {
        var me = await MyMembership();
        if (me is null)
            return BadRequestMessage("You're not in a family.");
        var f = await db.Families.FindAsync(me.FamilyId);
        var others = (await MemberIds(me.FamilyId)).Where(id => id != U).ToList();
        if (me.Role == "admin" && others.Count > 0)
            return BadRequestMessage("Make another member the admin before leaving.");
        db.FamilyMembers.Remove(me);
        if (others.Count == 0 && f is not null)
        {
            db.FamilyInvites.RemoveRange(db.FamilyInvites.Where(i => i.FamilyId == f.Id));
            if (!string.IsNullOrWhiteSpace(f.PhotoKey))
                await storage.DeleteAsync("users", f.PhotoKey);
            db.Families.Remove(f);
        }

        await db.SaveChangesAsync();
        if (others.Count > 0)
            await Notify(others, "family_member_left", "Member left", $"{await NameOf(U)} left {f?.Name}.", new { familyId = f?.Id, userId = U });
        return NoContent();
    }

    /// <summary>
    /// Returns the caller's family: picture, members with roles/rights, pending invitations (for
    /// managers) and what the caller is allowed to do.
    /// </summary>
    /// <response code="200">Zero or one family.</response>
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get()
    {
        var me = await MyMembership();
        if (me is null)
            return Ok(Array.Empty<object>());
        var f = await db.Families.FindAsync(me.FamilyId);
        if (f is null)
            return Ok(Array.Empty<object>());
        var members = await db.FamilyMembers.Where(x => x.FamilyId == f.Id && x.Status == "approved").ToListAsync();
        var userIds = members.Select(m => m.UserId).ToList();
        var users = await db.Users.Where(x => userIds.Contains(x.Id)).ToListAsync();
        var canManage = CanManage(me);
        var pending = canManage
            ? await db.FamilyInvites.Where(x => x.FamilyId == f.Id && x.Status == "pending").ToListAsync()
            : [];
        var pendingUserIds = pending.Select(x => x.InviteeUserId).Concat(pending.Select(x => x.InviterUserId)).Distinct().ToList();
        var pendingUsers = await db.Users.Where(x => pendingUserIds.Contains(x.Id)).ToListAsync();
        return Ok(new[]
        {
            new
            {
                f.Id,
                f.Name,
                PhotoUrl = Photo(f.PhotoKey),
                MyRole = me.Role,
                CanManage = canManage,
                IsAdmin = me.Role == "admin",
                Members = members
                    .OrderByDescending(m => m.Role == "admin").ThenByDescending(m => m.CanManageMembers).ThenBy(m => m.CreatedAt)
                    .Select(m =>
                    {
                        var u = users.First(z => z.Id == m.UserId);
                        return new { m.Id, UserId = u.Id, u.Email, u.DisplayName, ProfileImageUrl = Photo(u.ProfileImageUrl), m.Role, m.CanManageMembers, IsMe = u.Id == U };
                    }),
                Pending = pending.Select(i =>
                {
                    var u = pendingUsers.FirstOrDefault(z => z.Id == i.InviteeUserId);
                    var by = pendingUsers.FirstOrDefault(z => z.Id == i.InviterUserId);
                    return new
                    {
                        i.Id,
                        i.InviteeUserId,
                        InviteeEmail = u?.Email,
                        InviteeDisplayName = u?.DisplayName,
                        InviteeProfileImageUrl = Photo(u?.ProfileImageUrl),
                        InvitedByName = by?.DisplayName,
                        i.Status,
                        i.CreatedAt
                    };
                })
            }
        });
    }
}
