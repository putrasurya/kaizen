// The focus log: how long each activity was focused on each date, kept apart
// from the timers so deleting or editing a timer never changes the past.
//
//   focus["2026-10-28"]["deep work"] = { title: "Deep work", seconds: 3000, rounds: 2 }
//
// An activity is a timer name. Timers are copied per weekday, so every copy
// with the same name (ignoring case and spaces at the ends) is one activity.
import { DAYS, getTodayKey, isDateKey, toDateKey } from "./day-helper";

export const focusKey = (title) => (typeof title === "string" ? title.trim().toLowerCase() : "");

const whole = (value) => (Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

export function sanitizeFocus(raw) {
  const focus = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return focus;
  for (const [date, day] of Object.entries(raw)) {
    if (!isDateKey(date) || !day || typeof day !== "object") continue;
    const clean = {};
    for (const [key, entry] of Object.entries(day)) {
      if (!entry || typeof entry !== "object") continue;
      const seconds = whole(entry.seconds);
      const rounds = whole(entry.rounds);
      const title = typeof entry.title === "string" && entry.title.trim() ? entry.title.trim() : key;
      if ((seconds || rounds) && focusKey(key)) clean[focusKey(key)] = { title, seconds, rounds };
    }
    if (Object.keys(clean).length) focus[date] = clean;
  }
  return focus;
}

// Adds focused time and/or finished rounds for `title` on `date`.
export function addFocus(focus, { date, title, seconds = 0, rounds = 0 }) {
  const key = focusKey(title);
  const add = { seconds: whole(seconds), rounds: whole(rounds) };
  if (!key || !isDateKey(date) || !(add.seconds || add.rounds)) return focus;
  const day = focus[date] ?? {};
  const entry = day[key] ?? { title: title.trim(), seconds: 0, rounds: 0 };
  return {
    ...focus,
    [date]: { ...day, [key]: { title: title.trim(), seconds: entry.seconds + add.seconds, rounds: entry.rounds + add.rounds } },
  };
}

// Moves an activity's history to a new name, merging into the new name's
// history if it already has one.
export function renameFocus(focus, from, to) {
  const oldKey = focusKey(from);
  const newKey = focusKey(to);
  if (!oldKey || !newKey || oldKey === newKey) {
    if (oldKey && oldKey === newKey) return relabel(focus, oldKey, to.trim());
    return focus;
  }
  const next = {};
  for (const [date, day] of Object.entries(focus)) {
    if (!day[oldKey]) {
      next[date] = day;
      continue;
    }
    const { [oldKey]: moved, ...rest } = day;
    const into = rest[newKey] ?? { seconds: 0, rounds: 0 };
    next[date] = { ...rest, [newKey]: { title: to.trim(), seconds: into.seconds + moved.seconds, rounds: into.rounds + moved.rounds } };
  }
  return next;
}

// Same activity, new spelling ("deep work" -> "Deep work").
function relabel(focus, key, title) {
  const next = {};
  for (const [date, day] of Object.entries(focus)) {
    next[date] = day[key] ? { ...day, [key]: { ...day[key], title } } : day;
  }
  return next;
}

// History from before the focus log existed: finished rounds per date,
// counted at the timer's current length (an estimate, but better than nothing).
export function focusFromReps(timers) {
  let focus = {};
  for (const timer of timers) {
    for (const [date, rounds] of Object.entries(timer.repsOn ?? {})) {
      focus = addFocus(focus, { date, title: timer.title, seconds: rounds * timer.seconds, rounds });
    }
  }
  return focus;
}

// ---- Reading it back for the heatmap ----

const parse = (dateKey) => {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (dateKey, n) => {
  const date = parse(dateKey);
  date.setDate(date.getDate() + n);
  return toDateKey(date);
};
export const weekdayOf = (dateKey) => getTodayKey(parse(dateKey));
export const mondayOf = (dateKey) => addDays(dateKey, -DAYS.indexOf(weekdayOf(dateKey)));

export const entryOn = (focus, key, date) => focus[date]?.[key] ?? { seconds: 0, rounds: 0 };

// A day counts as done with at least one finished round.
export const isDone = (entry) => entry.rounds > 0;

// Weekdays this activity is planned on: where a timer with its name exists.
export const plannedDays = (timers, key) => new Set(timers.filter((t) => focusKey(t.title) === key).map((t) => t.day));

// The first date with anything logged; earlier days aren't counted as missed.
export function firstDate(focus, key) {
  return Object.keys(focus)
    .filter((date) => focus[date][key])
    .sort()[0] ?? null;
}

// Days done in a row, counting back from today. Days it isn't planned on are
// skipped (unless done, which counts), and today doesn't break the streak
// while it's still going.
export function streak(focus, key, planned, today) {
  const start = firstDate(focus, key);
  if (!start) return 0;
  let count = 0;
  for (let date = today; date >= start; date = addDays(date, -1)) {
    if (isDone(entryOn(focus, key, date))) count++;
    else if (planned.has(weekdayOf(date)) && date !== today) break;
  }
  return count;
}

export function secondsBetween(focus, key, from, to) {
  let total = 0;
  for (let date = from; date <= to; date = addDays(date, 1)) total += entryOn(focus, key, date).seconds;
  return total;
}

// Shade 0..4 by time focused: none, under 30 min, under 1 h, under 2 h, 2 h+.
export function level(seconds) {
  if (seconds <= 0) return 0;
  if (seconds < 30 * 60) return 1;
  if (seconds < 60 * 60) return 2;
  if (seconds < 2 * 60 * 60) return 3;
  return 4;
}
