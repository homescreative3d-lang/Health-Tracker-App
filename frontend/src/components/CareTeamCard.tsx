import { useEffect, useState } from "react";
import { Crown, Mail, ShieldCheck, Users } from "lucide-react";
import { api, type CareTeamMember } from "../api";
import { Avatar } from "./Avatar";
import { PhoneLink } from "./PhoneLink";

/** Everyone caring for a patient, with call/email links (used by caregivers and linked patients). */
export function CareTeamCard({
  patientId,
  title = "Care team",
}: {
  patientId: string;
  title?: string;
}) {
  const [team, setTeam] = useState<CareTeamMember[] | null>(null);
  useEffect(() => {
    let active = true;
    api
      .careTeam(patientId)
      .then((t) => active && setTeam(t))
      .catch(() => active && setTeam([]));
    return () => {
      active = false;
    };
  }, [patientId]);
  if (!team || team.length === 0) return null;
  return (
    <section className="card care-team">
      <div className="section-heading">
        <h3>{title}</h3>
        <Users size={18} aria-hidden="true" />
      </div>
      <ul>
        {team.map((m) => (
          <li key={m.id} className="care-member">
            <Avatar name={m.displayName} src={m.profileImageUrl} />
            <div className="care-member-copy">
              <b>{m.displayName}</b>
              <span className="care-tags">
                {m.isPrimary && <span className="role-tag manager">Primary caregiver</span>}
                {m.familyRole === "admin" && (
                  <span className="role-tag admin">
                    <Crown size={11} aria-hidden="true" /> Family admin
                  </span>
                )}
                {m.familyRole !== "admin" && m.canManage && (
                  <span className="role-tag manager">
                    <ShieldCheck size={11} aria-hidden="true" /> Manages family
                  </span>
                )}
              </span>
              <span className="care-contact">
                <a href={`mailto:${m.email}`} className="mail-link">
                  <Mail size={13} aria-hidden="true" /> {m.email}
                </a>
                <PhoneLink phone={m.phone} />
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
