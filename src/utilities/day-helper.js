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
