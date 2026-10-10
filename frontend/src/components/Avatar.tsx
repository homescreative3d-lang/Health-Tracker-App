import { initials } from "../lib/text";

type AvatarProps = {
  /** Person's name, used for initials and alt text. */
  name?: string | null;
  /** Optional photo URL. */
  src?: string | null;
  /** Visual size. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Extra class names. */
  className?: string;
};

/** Circular photo with an initials fallback. Decorative (empty alt) because the name is shown alongside. */
export function Avatar({ name, src, size = "md", className = "" }: AvatarProps) {
  return (
    <span className={`avatar avatar-${size} ${className}`.trim()} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials(name)}
    </span>
  );
}
