import { Phone } from "lucide-react";
import { useCare } from "../hooks/CareAppContext";
import { splitPhone } from "./PhoneInput";

/**
 * Formats an E.164 number for display using the known country codes, e.g.
 * "+919845012345" → "+91 98450 12345", "+14155550100" → "+1 415 555 0100".
 */
export function formatPhone(value: string): string {
  if (!value) return "";
  const [code, rest] = splitPhone(value);
  if (code === "other") return value;
  const digits = rest.replace(/\D/g, "");
  if (code === "+1" && digits.length === 10) return `+1 ${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  if (digits.length === 10) return `${code} ${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `${code} ${digits.replace(/(\d{3,4})(?=\d{3,})/g, "$1 ")}`;
}

/**
 * Tap-to-call link: on phones it opens the dialer; on computers it opens the default calling
 * app (if any). Falls back to plain text when the phone_calls feature is off.
 */
export function PhoneLink({
  phone,
  compact = false,
}: {
  phone?: string | null;
  compact?: boolean;
}) {
  const app = useCare();
  if (!phone) return null;
  const label = formatPhone(phone);
  if (!app.can("phone_calls")) return <span className="phone-text">{label}</span>;
  return (
    <a
      className={compact ? "phone-link compact" : "phone-link"}
      href={`tel:${phone}`}
      aria-label={`Call ${label}`}
    >
      <Phone size={14} aria-hidden="true" />
      {!compact && label}
    </a>
  );
}
