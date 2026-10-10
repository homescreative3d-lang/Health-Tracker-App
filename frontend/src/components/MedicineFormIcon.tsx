import { Pill, Syringe, Droplets, Wind, Package } from "lucide-react";

export function MedicineFormIcon({ form, size = 21 }: { form: string; size?: number }) {
  switch (form.toLowerCase()) {
    case "injection":
      return <Syringe size={size} />;
    case "drops":
    case "syrup":
      return <Droplets size={size} />;
    case "inhaler":
      return <Wind size={size} />;
    case "powder":
    case "other":
      return <Package size={size} />;
    default:
      return <Pill size={size} />;
  }
}
