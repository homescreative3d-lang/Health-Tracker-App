import { Droplets, Package, Pill, Syringe, Wind } from "lucide-react";

/**
 * Icon representing a medicine's form (pill, injection, drops...).
 * @param form - Medicine form as stored on the API.
 * @param size - Icon size in px.
 */
export function MedicineFormIcon({ form, size = 21 }: { form: string; size?: number }) {
  switch ((form || "").toLowerCase()) {
    case "injection":
      return <Syringe size={size} aria-hidden="true" />;
    case "drops":
    case "syrup":
      return <Droplets size={size} aria-hidden="true" />;
    case "inhaler":
      return <Wind size={size} aria-hidden="true" />;
    case "powder":
    case "other":
      return <Package size={size} aria-hidden="true" />;
    default:
      return <Pill size={size} aria-hidden="true" />;
  }
}
