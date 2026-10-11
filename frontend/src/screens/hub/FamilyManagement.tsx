import { useEffect, useState } from "react";
import {
  Bell,
  Check,
  Crown,
  LogOut,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { api, type Family, type FamilyUser, type Notification } from "../../api";
import { err } from "../../lib/errors";
import { initials } from "../../lib/text";
import { Avatar } from "../../components/Avatar";
import { Field } from "../../components/Field";
import { ImagePickerButtons } from "../../components/ImagePickerButtons";
import { InlineError } from "../../components/InlineError";
import { LogoMark } from "../../components/LogoMark";
import { Modal } from "../../components/Modal";
import { EmptyArt } from "../../components/art/EmptyArt";

type FamilyManagementProps = {
  family: Family[];
  notifications: Notification[];
  /** Reloads family, notifications and accessible patients. */
  onChange: () => Promise<void>;
  /** Accepts/declines an invitation addressed to the user. */
  onRespond: (n: Notification, accept: boolean) => Promise<boolean>;
};

/** A destructive action waiting for confirmation. */
type Pending = { title: string; body: string; confirm: string; run: () => Promise<void> } | null;

/** Small yes/no switch used for the "can manage members" right. */
function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}

/**
 * Family management with roles and consent.
 *
 * - One family per person: the create section is disabled once you're in a family.
 * - The admin (creator) and members granted "Can add/remove members" can invite, remove,
 *   withdraw invitations and edit the family name/picture. Only the admin grants that right or
 *   hands over the admin role.
 * - Invitations addressed to you can be accepted or declined here and from the bell.
 */
export function FamilyManagement({
  family,
  notifications,
  onChange,
  onRespond,
}: FamilyManagementProps) {
  const active = family[0];
  const [q, setQ] = useState("");
  const [results, setResults] = useState<FamilyUser[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState<Pending>(null);
  const invites = notifications.filter((n) => n.type === "family_invite" && !n.isRead);

  // Debounced, race-safe user search.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return setResults([]);
    let current = true;
    const t = window.setTimeout(() => {
      api
        .familySearch(term)
        .then((r) => current && setResults(r))
        .catch((e) => current && setMessage({ text: err(e), error: true }));
    }, 300);
    return () => {
      current = false;
      window.clearTimeout(t);
    };
  }, [q]);

  /**
   * Runs an action with a busy key, reports success or the API's error, then refreshes.
   * @param key - Busy key (e.g. "invite:<id>").
   * @param fn - The API call.
   * @param ok - Success message.
   */
  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMessage(null);
    try {
      await fn();
      await onChange();
      setMessage({ text: ok });
    } catch (e) {
      setMessage({ text: err(e), error: true });
    } finally {
      setBusy(null);
    }
  };

  /** Asks for confirmation before a destructive action. */
  const confirm = (p: NonNullable<Pending>) => setConfirming(p);

  const memberIds = new Set(active?.members.map((m) => m.userId) || []);
  const pendingIds = new Set(active?.pending.map((p) => p.inviteeUserId) || []);

  return (
    <div className="family-page">
      {invites.length > 0 && (
        <section className="card family-invites" aria-label="Invitations for you">
          <div className="section-heading">
            <h3>Invitations for you</h3>
            <span className="status-chip status-pending">{invites.length} new</span>
          </div>
          {invites.map((n) => (
            <div className="family-request" key={n.id}>
              <Bell size={18} aria-hidden="true" />
              <div>
                <b>{n.title}</b>
                <p>{n.message}</p>
                {active && (
                  <small className="muted">
                    You're already in {active.name}. Leave it first to join another family.
                  </small>
                )}
              </div>
              <div className="invite-actions">
                <button
                  className="btn soft sm"
                  disabled={!!busy}
                  onClick={() => void onRespond(n, false)}
                >
                  <X size={14} aria-hidden="true" /> Decline
                </button>
                <button
                  className="btn primary sm"
                  disabled={!!busy || !!active}
                  onClick={() => void onRespond(n, true)}
                >
                  <Check size={14} aria-hidden="true" /> Accept
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {!active ? (
        <section className="card family-card">
          <div className="family-empty">
            <EmptyArt kind="people" size={140} />
            <div>
              <h3>Create your family</h3>
              <p className="muted">
                You'll be the admin. Invite people who help with care. They see your patients only
                after accepting.
              </p>
            </div>
          </div>
          <div className="family-create">
            <Field label="Family name">
              <input
                className="input"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sharma family"
              />
            </Field>
            <button
              className="btn primary"
              disabled={!!busy || !name.trim()}
              onClick={() =>
                act(
                  "create",
                  () => api.createFamily(name.trim()),
                  "Family created. You're the admin.",
                )
              }
            >
              <Plus size={16} aria-hidden="true" />
              {busy === "create" ? "Creating…" : "Create family"}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="family-hero">
            <span className="family-photo">
              {active.photoUrl ? <img src={active.photoUrl} alt="" /> : <LogoMark size={56} />}
            </span>
            <div className="family-hero-copy">
              <span className="eyebrow">Your family</span>
              <h2>{active.name}</h2>
              <div className="family-hero-tags">
                <span>
                  {active.members.length} member{active.members.length === 1 ? "" : "s"}
                </span>
                <span
                  className={
                    active.isAdmin
                      ? "role-tag admin"
                      : active.canManage
                        ? "role-tag manager"
                        : "role-tag"
                  }
                >
                  {active.isAdmin
                    ? "You're the admin"
                    : active.canManage
                      ? "You can manage members"
                      : "Member"}
                </span>
              </div>
            </div>
            <div className="family-hero-actions">
              {active.canManage && (
                <button className="btn light" onClick={() => setEditing(true)}>
                  <Pencil size={16} aria-hidden="true" /> Edit family
                </button>
              )}
              <button
                className="btn outline-light"
                onClick={() =>
                  confirm({
                    title: `Leave ${active.name}?`,
                    body:
                      active.isAdmin && active.members.length > 1
                        ? "You're the admin. Make another member the admin before leaving."
                        : active.members.length === 1
                          ? "You're the only member, so the family will be deleted."
                          : "You'll stop seeing this family's patients, and they'll stop seeing yours.",
                    confirm: "Leave family",
                    run: () => act("leave", () => api.leaveFamily(), "You left the family."),
                  })
                }
              >
                <LogOut size={16} aria-hidden="true" /> Leave
              </button>
            </div>
          </section>

          <div className="family-grid">
            <section className="card family-card">
              <div className="family-orbit" aria-hidden="true">
                <div className="family-orbit-center">
                  {active.photoUrl ? (
                    <img className="orbit-photo" src={active.photoUrl} alt="" />
                  ) : (
                    <LogoMark size={44} />
                  )}
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

              {active.canManage ? (
                <div className="family-search">
                  <Field label="Add someone by name or email">
                    <div className="icon-input">
                      <Search aria-hidden="true" />
                      <input
                        className="input"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search registered users"
                      />
                    </div>
                  </Field>
                  {results.length > 0 && (
                    <div className="family-results">
                      {results.map((r) => {
                        const status = memberIds.has(r.id)
                          ? "Member"
                          : pendingIds.has(r.id)
                            ? "Invited"
                            : r.inFamily
                              ? "In a family"
                              : null;
                        return (
                          <div className="family-result" key={r.id}>
                            <Avatar name={r.displayName} src={r.profileImageUrl} />
                            <div>
                              <b>{r.displayName}</b>
                              <span>{r.email}</span>
                            </div>
                            {status ? (
                              <span className="status-chip status-info">{status}</span>
                            ) : (
                              <button
                                className="btn primary sm"
                                disabled={!!busy}
                                onClick={() =>
                                  act(
                                    `invite:${r.id}`,
                                    () => api.inviteFamilyMember(r.id),
                                    `Invitation sent to ${r.displayName}. Waiting for their answer.`,
                                  )
                                }
                              >
                                <Plus size={14} aria-hidden="true" />
                                {busy === `invite:${r.id}` ? "Inviting…" : "Invite"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="notice info">
                  <ShieldCheck size={18} aria-hidden="true" />
                  <p>Only the family admin, or members they allow, can add or remove people.</p>
                </div>
              )}
              {message && (
                <div
                  className={message.error ? "family-message error" : "family-message"}
                  role="status"
                >
                  {message.text}
                </div>
              )}
            </section>

            <section className="card family-card">
              <div className="family-subhead">
                <h3>Members</h3>
                <span className="muted">{active.members.length}</span>
              </div>
              <ul className="member-list">
                {active.members.map((m) => {
                  const isAdmin = m.role === "admin";
                  const canRemove =
                    active.canManage &&
                    !m.isMe &&
                    !isAdmin &&
                    (active.isAdmin || !m.canManageMembers);
                  return (
                    <li className="member-row" key={m.userId || m.id}>
                      <Avatar name={m.displayName} src={m.profileImageUrl} />
                      <div className="member-copy">
                        <b>
                          {m.displayName}
                          {m.isMe && <span className="you-tag">You</span>}
                        </b>
                        <span>{m.email}</span>
                        <div className="member-tags">
                          {isAdmin && (
                            <span className="role-tag admin">
                              <Crown size={12} aria-hidden="true" /> Admin
                            </span>
                          )}
                          {!isAdmin && m.canManageMembers && (
                            <span className="role-tag manager">
                              <ShieldCheck size={12} aria-hidden="true" /> Can manage
                            </span>
                          )}
                        </div>
                        {active.isAdmin && !isAdmin && (
                          <Toggle
                            label="Can add/remove members"
                            checked={!!m.canManageMembers}
                            disabled={!!busy}
                            onChange={(v) =>
                              act(
                                `perm:${m.userId}`,
                                () => api.setFamilyPermissions(m.userId!, v),
                                v
                                  ? `${m.displayName} can now manage members.`
                                  : `${m.displayName} can no longer manage members.`,
                              )
                            }
                          />
                        )}
                      </div>
                      <div className="member-actions">
                        {active.isAdmin && !isAdmin && (
                          <button
                            className="btn ghost sm"
                            onClick={() =>
                              confirm({
                                title: `Make ${m.displayName} the admin?`,
                                body: "They'll control who can manage the family. You'll stay a member who can add and remove people.",
                                confirm: "Make admin",
                                run: () =>
                                  act(
                                    `admin:${m.userId}`,
                                    () => api.makeFamilyAdmin(m.userId!),
                                    `${m.displayName} is now the admin.`,
                                  ),
                              })
                            }
                          >
                            <Crown size={14} aria-hidden="true" /> Make admin
                          </button>
                        )}
                        {canRemove && (
                          <button
                            className="btn danger-ghost sm"
                            onClick={() =>
                              confirm({
                                title: `Remove ${m.displayName}?`,
                                body: "They'll lose access to this family's patients right away and will be notified.",
                                confirm: "Remove",
                                run: () =>
                                  act(
                                    `remove:${m.userId}`,
                                    () => api.removeFamilyMember(m.userId!),
                                    `${m.displayName} was removed.`,
                                  ),
                              })
                            }
                          >
                            <UserMinus size={14} aria-hidden="true" /> Remove
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {active.canManage && active.pending.length > 0 && (
                <>
                  <div className="family-subhead">
                    <h4>Waiting for consent</h4>
                    <span className="status-chip status-pending">{active.pending.length}</span>
                  </div>
                  <ul className="member-list">
                    {active.pending.map((p) => (
                      <li className="member-row pending" key={p.id}>
                        <Avatar name={p.inviteeDisplayName} src={p.inviteeProfileImageUrl} />
                        <div className="member-copy">
                          <b>{p.inviteeDisplayName || "Invited user"}</b>
                          <span>
                            {p.inviteeEmail}
                            {p.invitedByName ? ` · invited by ${p.invitedByName}` : ""}
                          </span>
                        </div>
                        <button
                          className="btn ghost sm"
                          disabled={!!busy}
                          onClick={() =>
                            act(
                              `cancel:${p.id}`,
                              () => api.cancelFamilyInvite(p.id),
                              "Invitation withdrawn.",
                            )
                          }
                        >
                          <X size={14} aria-hidden="true" /> Withdraw
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </div>

          <section className="card family-card disabled-card" aria-disabled="true">
            <Users size={20} aria-hidden="true" />
            <div>
              <b>Create a new family</b>
              <p className="muted">
                Unavailable: you're already in {active.name}. A person can belong to one family
                only.
              </p>
            </div>
          </section>
        </>
      )}

      {editing && active && (
        <EditFamilyDialog family={active} onClose={() => setEditing(false)} onSaved={onChange} />
      )}
      {confirming && (
        <Modal
          title={confirming.title}
          onClose={() => setConfirming(null)}
          actions={
            <>
              <button className="btn soft" onClick={() => setConfirming(null)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={async () => {
                  const run = confirming.run;
                  setConfirming(null);
                  await run();
                }}
              >
                {confirming.confirm}
              </button>
            </>
          }
        >
          <p className="muted">{confirming.body}</p>
        </Modal>
      )}
    </div>
  );
}

/** Edits the family name and picture (admin or members with the manage right). */
function EditFamilyDialog({
  family,
  onClose,
  onSaved,
}: {
  family: Family;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(family.name);
  const [photo, setPhoto] = useState(family.photoUrl || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  /** Validates and saves. */
  const save = async () => {
    if (!name.trim()) return setError("Enter a family name.");
    setSaving(true);
    setError("");
    try {
      await api.updateFamily(name.trim(), photo);
      await onSaved();
      onClose();
    } catch (e) {
      setError(err(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Edit family"
      onClose={onClose}
      actions={
        <>
          <button className="btn soft" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="family-edit-photo">
        <span className="family-photo large">
          {photo ? <img src={photo} alt="" /> : <LogoMark size={64} />}
        </span>
        <ImagePickerButtons
          label="family picture"
          onPick={setPhoto}
          onError={setError}
          onRemove={photo ? () => setPhoto("") : undefined}
        />
      </div>
      <Field label="Family name">
        <input
          className="input"
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </Field>
      <p className="field-hint">Members are notified when the family details change.</p>
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  );
}
