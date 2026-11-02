import { useSyncExternalStore } from "react";

// Timers that are counting down right now, for the browser tab's title:
// id -> { title, phase, endsAt } (endsAt: when it reaches zero, epoch ms).
let running = new Map();
const listeners = new Set();

export function setRunning(id, info) {
  const next = new Map(running);
  if (info) next.set(id, info);
  else if (next.has(id)) next.delete(id);
  else return;
  running = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const useRunningTimers = () => useSyncExternalStore(subscribe, () => running);

// "24:13", "1:05:00", "0:09"
export function formatClock(totalSeconds) {
  const s = Math.max(0, totalSeconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = String(s % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

const PHASE = { break: "Break", long: "Long break" };

// The tab title while timers run: the one that ends soonest, e.g.
// "24:13 Deep work · Kaizen", "4:32 Break · Deep work · Kaizen", plus "+1"
// when another one is running too. With `hideNames` (privacy lock on) only
// the time and phase show. Null when nothing runs.
export function tabTitle(timers, now = Date.now(), { hideNames = false } = {}) {
  const list = [...timers.values()].sort((a, b) => a.endsAt - b.endsAt);
  if (!list.length) return null;
  const [first] = list;
  const time = formatClock(Math.ceil((first.endsAt - now) / 1000));
  const name = hideNames ? "" : first.title;
  const what = [PHASE[first.phase], name].filter(Boolean).join(" · ");
  const more = list.length > 1 ? ` +${list.length - 1}` : "";
  return `${[time, what].filter(Boolean).join(" ")}${more} · Kaizen`;
}
