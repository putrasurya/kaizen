import { useEffect, useState } from "react";

// The current time, re-rendering every `intervalMs` and whenever the app comes
// back into view. Read fresh on every render (not cached in state), so a tap
// that re-renders the component is seen at the exact moment it happened.
export function useNow(intervalMs = 30 * 1000) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const tick = () => setTick((n) => n + 1);
    const id = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [intervalMs]);

  return Date.now();
}
