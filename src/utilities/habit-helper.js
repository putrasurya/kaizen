import { toDateKey, weekDateOf } from "./day-helper";
import { routineDay } from "./auto-tap";

// Two kinds of habit:
// - "daily": a fixed number of slots to fill each day (pray 5x, 8 glasses of
//   water). `log` maps a date to how many slots were filled that day.
// - "routine": a +/- balance (resisting an urge). `log` maps a date to that
//   day's { plus, minus } taps. A slip is a debt; good taps pay it back.
// Both keep their whole log, so nothing has to run at midnight or on Monday:
// "this week" and the history are just different views over the same dates.
export const HABIT_KINDS = ["daily", "routine"];
export const MAX_TARGET = 20;
export const HISTORY_WEEKS = 8;

// How far the balance marker can travel from the centre before it pins at the
// edge. The label still shows the real number.
export const BALANCE_RANGE = 10;

export const isHabitKind = (value) => HABIT_KINDS.includes(value);

export function toTarget(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, 1), MAX_TARGET) : 1;
}

export function addDays(dateKey, days) {
  const [year, month, date] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, date + days));
}

// Monday of the Monday-first week containing `dateKey`.
export const weekStartOf = (dateKey) => weekDateOf("mon", dateKey);

export const weekDates = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

// The last `count` week starts up to and including this week, oldest first,
// skipping weeks before `since` (when the habit was created).
export function recentWeekStarts(todayDate, count = HISTORY_WEEKS, since) {
  const current = weekStartOf(todayDate);
  const first = since ? weekStartOf(since) : "";
  return Array.from({ length: count }, (_, i) => addDays(current, (i - count + 1) * 7)).filter(
    (start) => start >= first || start === current
  );
}

// Slots filled on one day, never more than today's target (lowering a target
// shouldn't show 7/5).
export const dailyCount = (habit, dateKey) => Math.min(habit.log[dateKey] ?? 0, habit.target);

export function dailyWeek(habit, weekStart) {
  const counts = weekDates(weekStart).map((date) => dailyCount(habit, date));
  return { counts, done: counts.reduce((a, b) => a + b, 0), possible: habit.target * 7 };
}

// The week's taps, manual and auto (as of `now`), and the resulting balance.
export function routineWeek(habit, weekStart, now = Date.now()) {
  let plus = 0;
  let minus = 0;
  let auto = 0;
  for (const date of weekDates(weekStart)) {
    const day = routineDay(habit, date, now);
    plus += day.totalPlus;
    minus += day.totalMinus;
    auto += day.autoPlus + day.autoMinus;
  }
  return { plus, minus, auto, balance: plus - minus };
}

export function balanceLabel(balance) {
  if (balance < 0) return `Owe ${-balance}`;
  if (balance > 0) return `+${balance} ahead`;
  return "Clear";
}

// "Sep 28" for a week start, in the reader's locale.
export function shortDate(dateKey) {
  const [year, month, date] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// What each habit looked like on one date, for showing beside a journal entry.
// Only habits that existed by then are included.
export function daySummary(habits, dateKey, now = Date.now()) {
  return habits
    .filter((habit) => !habit.createdOn || habit.createdOn <= dateKey)
    .map((habit) => {
      if (habit.kind === "daily") {
        const count = dailyCount(habit, dateKey);
        return { id: habit.id, name: habit.name, text: `${count}/${habit.target}`, done: count >= habit.target };
      }
      const { totalPlus: plus, totalMinus: minus } = routineDay(habit, dateKey, now);
      const text = plus || minus ? [plus && `+${plus}`, minus && `−${minus}`].filter(Boolean).join(" ") : "no taps";
      // Flagged only when slips outweighed good taps: one slip on a good day
      // shouldn't colour the whole day as a failure.
      return { id: habit.id, name: habit.name, text, owed: minus > plus };
    });
}

// "Sunday, Oct 4" (or with the year when it isn't this year).
export function longDate(dateKey, todayKey) {
  const [year, month, date] = dateKey.split("-").map(Number);
  const sameYear = !todayKey || todayKey.slice(0, 4) === dateKey.slice(0, 4);
  return new Date(year, month - 1, date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
