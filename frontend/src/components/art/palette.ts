/** Brand colors shared by all in-app illustrations (mirrors the logo and landing art). */
export const ART = {
  ink: "#0F2A33",
  teal: "#0B7A6E",
  tealSoft: "#E0F2EE",
  morning: "#F2A93B",
  afternoon: "#2FA37A",
  evening: "#E8735A",
  night: "#5B6BE0",
  sky: "#EEF1FD",
  cream: "#FFF6E6",
  white: "#FFFFFF",
};

/** Daypart for the current local hour (matches the dose grouping boundaries). */
export function currentDayPart(d = new Date()): "Morning" | "Afternoon" | "Evening" | "Night" {
  const m = d.getHours() * 60 + d.getMinutes();
  return m < 690 ? "Morning" : m < 1020 ? "Afternoon" : m < 1260 ? "Evening" : "Night";
}
