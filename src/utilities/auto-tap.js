import { toDateKey } from "./day-helper";

// Auto tap for a routine: one tap in `direction` ("plus" or "minus") every
// `everyMinutes`, at most `maxPerDay` per calendar day. A manual tap in the
// opposite direction restarts the clock (a slip doesn't earn the hour it
// happened in; drinking water pushes the next −1 a full interval away).
//
// Nothing runs in the background: the count is a pure function of time, so it
// is worked out whenever it's needed, and is the same as if it had been
// ticking the whole time the app was closed.
//
// Persisted shape on a routine:
//   auto: { direction, everyMinutes, maxPerDay, since, frozenThrough }
//   log[date]: { plus, minus, plusAt[], minusAt[], autoPlus, autoMinus }
// `since` is when these settings started (ms). Days up to `frozenThrough`
// have their auto taps saved in the log (autoPlus/autoMinus), so changing the
// settings later never rewrites them. Later days are computed live.

export const AUTO_LIMITS = { minEvery: 5, maxEvery: 24 * 60, minMax: 1, maxMax: 100 };
export const AUTO_DIRECTIONS = ["plus", "minus"];

const MINUTE = 60 * 1000;
const opposite = (direction) => (direction === "plus" ? "minus" : "plus");
export const autoField = (direction) => (direction === "plus" ? "autoPlus" : "autoMinus");

function shiftDate(dateKey, days) {
  const [year, month, date] = dateKey.split("-").map(Number);
  return toDateKey(new Date(year, month - 1, date + days));
}

// [midnight, next midnight) of a local calendar date, in ms.
export function dayBounds(dateKey) {
  const [year, month, date] = dateKey.split("-").map(Number);
  return [new Date(year, month - 1, date).getTime(), new Date(year, month - 1, date + 1).getTime()];
}

const clampInt = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

// Settings as typed in the form, made safe. Returns null for "off".
export function toAutoSettings(raw) {
  if (!raw || !AUTO_DIRECTIONS.includes(raw.direction)) return null;
  return {
    direction: raw.direction,
    everyMinutes: clampInt(raw.everyMinutes, AUTO_LIMITS.minEvery, AUTO_LIMITS.maxEvery, 60),
    maxPerDay: clampInt(raw.maxPerDay, AUTO_LIMITS.minMax, AUTO_LIMITS.maxMax, 8),
  };
}

// Whole intervals between `from` and `to`, restarting at each opposite tap.
// Also returns when the current (last) stretch began, for "next in N min".
function earned(auto, entry, from, to) {
  const interval = auto.everyMinutes * MINUTE;
  const restarts = (entry?.[`${opposite(auto.direction)}At`] ?? [])
    .filter((at) => at > from && at <= to)
    .sort((a, b) => a - b);
  let start = from;
  let count = 0;
  for (const at of restarts) {
    count += Math.floor((at - start) / interval);
    start = at;
  }
  count += Math.floor((to - start) / interval);
  return { count, stretchStart: start };
}

// Auto taps on `dateKey` that aren't saved in the log yet, as of `now`.
// Null when auto is off, the day is already frozen, or it's in the future.
export function liveAuto(habit, dateKey, now = Date.now()) {
  const auto = habit.auto;
  if (!auto || (auto.frozenThrough && dateKey <= auto.frozenThrough)) return null;
  const todayKey = toDateKey(new Date(now));
  if (dateKey > todayKey) return null;

  const [dayStart, dayEnd] = dayBounds(dateKey);
  const from = Math.max(dayStart, auto.since);
  const to = Math.min(dayEnd, now);
  const field = autoField(auto.direction);
  const saved = habit.log[dateKey]?.[field] ?? 0;
  const room = Math.max(0, auto.maxPerDay - saved);
  const interval = auto.everyMinutes * MINUTE;
  if (to <= from) {
    // Just switched on (or not started yet today): the first tap is one interval away.
    const next = dateKey === todayKey && room > 0 && from + interval < dayEnd ? from + interval : null;
    return { field, count: 0, total: saved, max: auto.maxPerDay, next };
  }

  const { count, stretchStart } = earned(auto, habit.log[dateKey], from, to);
  const added = Math.min(room, count);
  let next = null;
  if (dateKey === todayKey && added < room) {
    next = stretchStart + (Math.floor((now - stretchStart) / interval) + 1) * interval;
    if (next >= dayEnd) next = null;
  }
  return { field, count: added, total: saved + added, max: auto.maxPerDay, next };
}

// One day's taps, manual and auto, as of `now`.
export function routineDay(habit, dateKey, now = Date.now()) {
  const entry = habit.log[dateKey] ?? {};
  const day = {
    plus: entry.plus ?? 0,
    minus: entry.minus ?? 0,
    autoPlus: entry.autoPlus ?? 0,
    autoMinus: entry.autoMinus ?? 0,
  };
  const live = liveAuto(habit, dateKey, now);
  if (live) day[live.field] += live.count;
  return { ...day, totalPlus: day.plus + day.autoPlus, totalMinus: day.minus + day.autoMinus };
}

// Saves every not-yet-frozen day's auto taps into the log, up to and
// including today. Done before the settings change, so earlier days (and the
// part of today already earned) keep what the old settings gave them.
export function freezeAuto(habit, now = Date.now()) {
  const auto = habit.auto;
  if (!auto) return habit;
  const todayKey = toDateKey(new Date(now));
  const sinceKey = toDateKey(new Date(auto.since));
  let date = auto.frozenThrough && auto.frozenThrough >= sinceKey ? shiftDate(auto.frozenThrough, 1) : sinceKey;
  const log = { ...habit.log };
  for (; date <= todayKey; date = shiftDate(date, 1)) {
    const live = liveAuto(habit, date, now);
    if (live?.count) {
      const entry = { plus: 0, minus: 0, ...log[date] };
      log[date] = { ...entry, [live.field]: (entry[live.field] ?? 0) + live.count };
    }
  }
  return { ...habit, log, auto: { ...auto, frozenThrough: todayKey } };
}

// Turns auto on, changes it, or (settings null) turns it off, from `now`.
export function withAutoSettings(habit, settings, now = Date.now()) {
  const frozen = freezeAuto(habit, now);
  if (!settings) return { ...frozen, auto: null };
  const unchanged =
    habit.auto &&
    habit.auto.direction === settings.direction &&
    habit.auto.everyMinutes === settings.everyMinutes &&
    habit.auto.maxPerDay === settings.maxPerDay;
  if (unchanged) return habit;
  return {
    ...frozen,
    auto: { ...settings, since: now, frozenThrough: shiftDate(toDateKey(new Date(now)), -1) },
  };
}
