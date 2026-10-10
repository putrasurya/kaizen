// Pomodoro settings on a timer. The timer's own duration is the focus round;
// after each finished round comes a break, and every `longEvery`-th round a
// long one. `autoBreak` starts the break by itself; off, it waits for play.
export const DEFAULT_POMODORO = { breakSeconds: 5 * 60, longBreakSeconds: 15 * 60, longEvery: 4, autoBreak: true };

const MINUTE = 60;
const clamp = (value, min, max, fallback) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback;
};

// Settings made safe; null (or anything unusable) means Pomodoro is off.
export function toPomodoro(raw) {
  if (!raw || typeof raw !== "object") return null;
  return {
    breakSeconds: clamp(raw.breakSeconds, MINUTE, 60 * MINUTE, DEFAULT_POMODORO.breakSeconds),
    longBreakSeconds: clamp(raw.longBreakSeconds, MINUTE, 120 * MINUTE, DEFAULT_POMODORO.longBreakSeconds),
    longEvery: clamp(raw.longEvery, 2, 12, DEFAULT_POMODORO.longEvery),
    autoBreak: raw.autoBreak !== false,
  };
}

// The break after a round, given how many rounds are now done today.
export function breakAfter(pomodoro, roundsToday) {
  const long = roundsToday > 0 && roundsToday % pomodoro.longEvery === 0;
  return { long, seconds: long ? pomodoro.longBreakSeconds : pomodoro.breakSeconds };
}

// Where today's rounds sit in the current cycle: 0..longEvery dots filled.
export function cyclePosition(pomodoro, roundsToday) {
  if (!roundsToday) return 0;
  return ((roundsToday - 1) % pomodoro.longEvery) + 1;
}
