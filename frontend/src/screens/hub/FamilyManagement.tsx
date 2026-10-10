import { useEffect, useState } from "react";
import { Bell, Check, Plus, User, Users } from "lucide-react";
import { api, type Family, type Notification } from "../../api";
import { err } from "../../lib/errors";
import { initials } from "../../lib/text";
import { Field } from "../../components/Field";
import { LogoMark } from "../../components/LogoMark";

/**
 * Family group management: create a group, search and invite registered users, see members
 * and pending invitations, and answer invitations addressed to you.
 *
 * Not yet supported by the API (flagged in the PR): removing members, cancelling invitations
 * and leaving a family.
 */
export function FamilyManagement({
  family,
  notifications,
  onChange,
}: {
  family: Family[];
  notifications: Notification[];
  onChange: () => Promise<void>;
}) {
  const [q, setQ] = useState(""),
    [results, setResults] = useState<any[]>([]),
    [name, setName] = useState(""),
    [busy, setBusy] = useState(false),
    [invited, setInvited] = useState<string[]>([]),
    [message, setMessage] = useState("");
  const active = family[0];
  const [responding, setResponding] = useState<string | null>(null);

  // Debounced, race-safe user search (previously every keystroke fired a request and
  // slower responses could overwrite newer ones).
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setResults([]);
    let current = true;
    const t = window.setTimeout(() => {
      api
        .familySearch(term)
        .then((r) => current && setResults(r))
        .catch((e) => current && setMessage(err(e)));
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(t);
    };
  }, [q]);

  /** Runs the search immediately (Search button / Enter). */
  const search = async (value = q) => {
    const term = value.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    try {
      setResults(await api.familySearch(term));
    } catch (e) {
      setMessage(err(e));
    }
  };
  /** Creates a family owned by the current user. */
  const create = async () => {
    if (!name.trim()) return setMessage("Enter a family name.");
    try {
      setBusy(true);
      await api.createFamily(name.trim());
      setName("");
      await onChange();
      setMessage("Family created.");
    } catch (e) {
      setMessage(err(e));
    } finally {
      setBusy(false);
    }
  };
  /** Invites a user; they gain access only after accepting. */
  const invite = async (id: string) => {
    try {
      const response = await api.inviteFamilyMember(id);
      setInvited((x) => (x.includes(id) ? x : [...x, id]));
      const invitee = response?.invitee;
      if (invitee) setResults((x) => x.map((r) => (r.id === id ? { ...r, ...invitee } : r)));
      await onChange();
      setMessage("Invitation sent. Waiting for their consent.");
    } catch (e) {
      setMessage(err(e));
    }
  };
  /** Accepts or rejects an invitation from its notification. */
  const respond = async (n: Notification, accept: boolean) => {
    setResponding(n.id);
    try {
      const d = JSON.parse(n.dataJson || "{}");
      if (d.inviteId) await api.respondFamilyInvite(d.inviteId, accept);
      await api.readNotification(n.id);
      await onChange();
      setMessage(accept ? "Family invitation accepted." : "Family invitation rejected.");
    } catch (e) {
      setMessage(err(e));
    } finally {
      setResponding(null);
    }
  };
  const pendingCount = active?.pending?.length || 0;
  const unreadInvites = notifications.filter((n) => n.type === "family_invite" && !n.isRead);
  return (
    <div className="card family-card">
      <div className="section-heading family-heading">
        <div>
          <h3>Your family group</h3>
          <p className="muted">Invite trusted users and share care access only after consent.</p>
        </div>
        <Users size={22} />
      </div>
      {!active ? (
        <div className="family-create">
          <Field label="Family name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sharma Family"
            />
          </Field>
          <button className="btn primary" disabled={busy} onClick={create}>
            <Plus size={16} />
            Create family
          </button>
        </div>
      ) : (
        <>
          <div className="family-name">
            <div>
              <b>{active.name}</b>
              <span className="muted">
                {active.members.length} approved member
                {active.members.length !== 1 ? "s" : ""}
              </span>
            </div>
            {pendingCount > 0 && <span className="status-pending">{pendingCount} pending</span>}
          </div>
          <div className="family-search">
            <Field label="Find a user by name or email">
              <input
                className="input"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                }}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Search registered users"
              />
            </Field>
            <button className="btn soft family-search-btn" onClick={() => search()}>
              Search
            </button>
          </div>
          {results.length > 0 && (
            <div className="family-results">
              {results.map((r) => {
                const wasInvited = invited.includes(r.id);
                return (
                  <div className="family-result" key={r.id}>
                    <div className="avatar">
                      {r.profileImageUrl ? (
                        <img src={r.profileImageUrl} alt="" />
                      ) : (
                        initials(r.displayName)
                      )}
                    </div>
                    <div>
                      <b>{r.displayName}</b>
                      <span>{r.email}</span>
                    </div>
                    <button
                      className="btn primary"
                      disabled={wasInvited}
                      onClick={() => invite(r.id)}
                    >
                      {wasInvited ? "Invited" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {message && (
            <div className="family-message" role="status">
              {message}
            </div>
          )}
          <div className="family-orbit" aria-hidden="true">
            <div className="family-orbit-center">
              <LogoMark size={44} />
              <small>Shared plan</small>
            </div>
            {[
              ...active.members.map((m) => ({
                id: m.userId || m.id,
                name: m.displayName,
                pending: false,
              })),
              ...active.pending.map((p) => ({
                id: p.id,
                name: p.inviteeDisplayName || "Invited",
                pending: true,
              })),
            ]
              .slice(0, 8)
              .map((m, i, all) => (
                <span
                  key={m.id}
                  className={m.pending ? "orbit-member pending" : "orbit-member"}
                  style={{ ["--a" as string]: `${(360 / all.length) * i}deg` }}
                  title={m.name}
                >
                  {initials(m.name)}
                </span>
              ))}
          </div>
          <div className="family-members">
            <div className="family-subhead">
              <h4>Family members</h4>
              {pendingCount > 0 && <span className="muted">{pendingCount} awaiting consent</span>}
            </div>
            {active.members.map((m) => (
              <div className="family-member" key={m.userId}>
                <div>
                  <b>{m.displayName}</b>
                  <span>{m.email}</span>
                </div>
                <span className="status-success">Approved</span>
              </div>
            ))}
            {active.pending.map((p) => (
              <div className="family-member" key={p.id}>
                <div className="family-member-person">
                  {p.inviteeProfileImageUrl ? (
                    <img className="small-avatar" src={p.inviteeProfileImageUrl} alt="" />
                  ) : (
                    <span className="avatar small-avatar">{initials(p.inviteeDisplayName)}</span>
                  )}
                  <div>
                    <b>{p.inviteeDisplayName || "User"}</b>
                    <span>{p.inviteeEmail || "Invitation sent"}</span>
                  </div>
                </div>
                <span className="status-pending">Pending consent</span>
              </div>
            ))}
          </div>
        </>
      )}
      {unreadInvites.length > 0 && (
        <div className="family-notifications">
          <div className="family-subhead">
            <h4>Family requests</h4>
            <span className="status-pending">{unreadInvites.length} new</span>
          </div>
          {unreadInvites.map((n) => (
            <div className="family-request" key={n.id}>
              <Bell size={18} />
              <div>
                <b>{n.title}</b>
                <p>{n.message}</p>
                <div className="dose-actions">
                  <button
                    className="btn ghost sm"
                    disabled={!!responding}
                    onClick={() => respond(n, false)}
                  >
                    Decline
                  </button>
                  <button
                    className="btn primary sm"
                    disabled={!!responding}
                    onClick={() => respond(n, true)}
                  >
                    <Check size={14} />
                    Accept
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
