import { useEffect, useState } from "react";

/** Common country calling codes (India first). Users can still type any code via "Other". */
export const COUNTRY_CODES = [
  { code: "+91", label: "🇮🇳 India +91" },
  { code: "+1", label: "🇺🇸 US / Canada +1" },
  { code: "+44", label: "🇬🇧 UK +44" },
  { code: "+971", label: "🇦🇪 UAE +971" },
  { code: "+966", label: "🇸🇦 Saudi Arabia +966" },
  { code: "+65", label: "🇸🇬 Singapore +65" },
  { code: "+61", label: "🇦🇺 Australia +61" },
  { code: "+49", label: "🇩🇪 Germany +49" },
  { code: "+977", label: "🇳🇵 Nepal +977" },
  { code: "+880", label: "🇧🇩 Bangladesh +880" },
  { code: "+94", label: "🇱🇰 Sri Lanka +94" },
];

/** Splits "+919845012345" into ["+91", "9845012345"] using the known codes (longest match). */
export function splitPhone(value: string): [string, string] {
  if (!value) return ["+91", ""];
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find((c) => value.startsWith(c.code));
  return match ? [match.code, value.slice(match.code.length)] : ["other", value];
}

/** True when a phone value (with country code) looks valid; empty is allowed. */
export const phoneValid = (value: string) =>
  !value || /^\+[1-9]\d{6,14}$/.test(value.replace(/[\s-()]/g, ""));

type PhoneInputProps = {
  /** Full number with country code, e.g. "+919845012345" ("" when empty). */
  value: string;
  onChange: (v: string) => void;
  label?: string;
};

/** Country-code picker + number field; emits the combined international number. */
export function PhoneInput({ value, onChange, label = "Phone number" }: PhoneInputProps) {
  const [initialCode, initialNumber] = splitPhone(value);
  const [code, setCode] = useState(initialCode);
  const [number, setNumber] = useState(initialNumber);
  useEffect(() => {
    const [c, n] = splitPhone(value);
    setCode(c);
    setNumber(n);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /** Recombines code + digits. */
  const emit = (c: string, n: string) => {
    const digits = n.replace(/[^\d+]/g, "");
    onChange(
      !digits
        ? ""
        : c === "other"
          ? digits.startsWith("+")
            ? digits
            : "+" + digits
          : c + digits.replace(/^0+/, ""),
    );
  };
  const invalid = !!value && !phoneValid(value);
  return (
    <div className="field">
      <span className="field-label">
        {label} <em>optional</em>
      </span>
      <div className="phone-input">
        <select
          className="input"
          aria-label="Country code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            emit(e.target.value, number);
          }}
        >
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
          <option value="other">Other (type +code)</option>
        </select>
        <input
          className={invalid ? "input invalid" : "input"}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-label={label}
          value={number}
          onChange={(e) => {
            setNumber(e.target.value);
            emit(code, e.target.value);
          }}
          placeholder={code === "other" ? "+code number" : "98450 12345"}
        />
      </div>
      {invalid && (
        <small className="field-error">Enter a valid number for the selected country code.</small>
      )}
    </div>
  );
}
