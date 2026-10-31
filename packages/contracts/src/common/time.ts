/** Georgia is UTC+4 all year (no daylight saving). */
export const TBILISI_OFFSET_MS = 4 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Midnight in Tbilisi at the start of the day containing `now` (ms), as an instant. */
export const tbilisiDayStart = (now: number) =>
  new Date(Math.floor((now + TBILISI_OFFSET_MS) / DAY_MS) * DAY_MS - TBILISI_OFFSET_MS);

/** `YYYY-MM-DD` of the Tbilisi calendar day of an instant (for grouping by day). */
export const tbilisiDateKey = (instant: number) =>
  new Date(instant + TBILISI_OFFSET_MS).toISOString().slice(0, 10);
