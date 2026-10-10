import { Today } from "../screens/hub/Today";

export const today = () => new Date().toISOString().slice(0, 10);

export const addDays = (s: string, n: number) => {
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export const part = (t: string) => {
  const [h, m] = t.split(":").map(Number),
    n = h * 60 + m;
  return n < 690 ? "Morning" : n < 1020 ? "Afternoon" : n < 1260 ? "Evening" : "Night";
};

export const dateLabel = (d: string) =>
  d === today()
    ? "Today"
    : d === addDays(today(), 1)
      ? "Tomorrow"
      : new Date(d + "T00:00:00").toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
