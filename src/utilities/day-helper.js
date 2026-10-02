// Weekday keys, Monday-first, as stored on each timer's `day` field.
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const DAY_LABELS = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

export const DAY_NAMES = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function isDayKey(value) {
  return DAYS.includes(value);
}

// Local-time weekday. Date#getDay() is Sunday-first (0 = Sunday).
export function getTodayKey(date = new Date()) {
  return DAYS[(date.getDay() + 6) % 7];
}

// Local calendar date as "YYYY-MM-DD" (not toISOString(), which is UTC).
export function toDateKey(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isDateKey(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

// The date of `day` within the Monday-first week containing `todayKey` (a
// "YYYY-MM-DD" date). Earlier weekdays resolve to this week's past date, later
// ones to this week's upcoming date.
export function weekDateOf(day, todayKey = toDateKey()) {
  const [year, month, date] = todayKey.split("-").map(Number);
  const today = new Date(year, month - 1, date);
  const offset = DAYS.indexOf(day) - DAYS.indexOf(getTodayKey(today));
  return toDateKey(new Date(year, month - 1, date + offset));
}
