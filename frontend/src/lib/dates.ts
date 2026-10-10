/**
 * Date and time helpers.
 *
 * All calendar dates in the app are plain `YYYY-MM-DD` strings in the user's *local*
 * time zone. The previous implementation used `toISOString()`, which converts to UTC
 * and shifted dates by a day for users east of UTC (e.g. IST), so "tomorrow" equalled
 * "today" and the calendar strip repeated days.
 */

/** Daypart names used to group doses, matching the compartments of a pill organizer. */
export type DayPart = "Morning" | "Afternoon" | "Evening" | "Night";

/** Ordered list of dayparts for rendering dose groups. */
export const DAY_PARTS: DayPart[] = ["Morning", "Afternoon", "Evening", "Night"];

/**
 * Formats a Date as a local `YYYY-MM-DD` string (no UTC conversion).
 * @param d - The date to format.
 */
export const toLocalIsoDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Parses a `YYYY-MM-DD` string as local midnight.
 * @param s - Date string in `YYYY-MM-DD` format.
 */
export const parseLocalDate = (s: string): Date => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

/** Returns today's date in the user's local time zone as `YYYY-MM-DD`. */
export const today = (): string => toLocalIsoDate(new Date());

/**
 * Adds (or subtracts) whole days to a `YYYY-MM-DD` date string.
 * @param s - Start date.
 * @param n - Number of days to add; negative values go back in time.
 */
export const addDays = (s: string, n: number): string => {
  const d = parseLocalDate(s);
  d.setDate(d.getDate() + n);
  return toLocalIsoDate(d);
};

/**
 * Formats a 24-hour `HH:mm` time as a 12-hour clock string, e.g. `8:05 PM`.
 * @param t - Time in `HH:mm` format.
 */
export const fmtTime = (t: string): string => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/**
 * Maps a dose time to its daypart bucket (before 11:30, before 17:00, before 21:00, otherwise night).
 * @param t - Time in `HH:mm` format.
 */
export const part = (t: string): DayPart => {
  const [h, m] = t.split(":").map(Number);
  const n = h * 60 + m;
  return n < 690 ? "Morning" : n < 1020 ? "Afternoon" : n < 1260 ? "Evening" : "Night";
};

/**
 * Human label for a date: "Today", "Tomorrow", or a short weekday/month/day string.
 * @param d - Date in `YYYY-MM-DD` format.
 */
export const dateLabel = (d: string): string =>
  d === today()
    ? "Today"
    : d === addDays(today(), 1)
      ? "Tomorrow"
      : parseLocalDate(d).toLocaleDateString(undefined, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });

/**
 * Returns the local Date at which a dose on `date` at `time` is scheduled.
 * @param date - Dose date (`YYYY-MM-DD`).
 * @param time - Dose time (`HH:mm`).
 */
export const scheduledAt = (date: string, time: string): Date => {
  const d = parseLocalDate(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return d;
};
