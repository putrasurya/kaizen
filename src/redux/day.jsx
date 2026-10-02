import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getTodayKey, toDateKey } from "../utilities/day-helper";

// The weekday the whole page (timers, todos, notes) is showing, plus which
// timers are running so the day picker can flag their day. None of it is
// persisted: the app always opens on today.
const dayContext = createContext(null);

function DayProvider({ children }) {
  // The full date, not just the weekday, so coming back exactly a week later
  // still counts as a new day (todos reset, the view returns to today).
  const [todayDate, setTodayDate] = useState(() => toDateKey());
  const [selectedDay, setSelectedDay] = useState(() => getTodayKey());
  const [runningIds, setRunningIds] = useState(() => new Set());

  // Jump back to today when the date rolls over, whether the app stayed open
  // past midnight or comes back from the background.
  useEffect(() => {
    const checkDay = () => {
      if (toDateKey() === todayDate) return;
      setTodayDate(toDateKey());
      setSelectedDay(getTodayKey());
    };
    const interval = setInterval(checkDay, 60 * 1000);
    document.addEventListener("visibilitychange", checkDay);
    window.addEventListener("focus", checkDay);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", checkDay);
      window.removeEventListener("focus", checkDay);
    };
  }, [todayDate]);

  const setTimerRunning = useCallback((id, play) => {
    setRunningIds((ids) => {
      if (ids.has(id) === play) return ids;
      const next = new Set(ids);
      if (play) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const [year, month, date] = todayDate.split("-").map(Number);
  const today = getTodayKey(new Date(year, month - 1, date));

  return (
    <dayContext.Provider
      value={{ today, todayDate, selectedDay, setSelectedDay, runningIds, setTimerRunning }}
    >
      {children}
    </dayContext.Provider>
  );
}

const noop = () => {};

// Outside a DayProvider (a component rendered on its own) everything shows
// today and the day can't be changed.
function useDay() {
  const value = useContext(dayContext);
  if (value) return value;
  return {
    today: getTodayKey(),
    todayDate: toDateKey(),
    selectedDay: getTodayKey(),
    setSelectedDay: noop,
    runningIds: new Set(),
    setTimerRunning: noop,
  };
}

export { DayProvider, useDay };
