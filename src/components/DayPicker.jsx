import { useContext } from "react";
import { Grid, Segmented } from "antd";
import { store } from "../redux/store";
import { useDay } from "../redux/day";
import { DAYS, DAY_LABELS, DAY_NAMES } from "../utilities/day-helper";
import styles from "./DayPicker.module.css";

// Mon..Sun switcher for the whole page: timers, todos and notes all show the
// picked day. Today gets an underline, and days with a running timer get a
// dot, since those timers are hidden while another day is being viewed.
function DayPicker() {
  const { timers } = useContext(store);
  const { today, selectedDay, setSelectedDay, runningIds } = useDay();
  const isMobile = !!Grid.useBreakpoint().xs;
  const runningDays = timers.filter((timer) => runningIds.has(timer.id)).map((timer) => timer.day);

  const options = DAYS.map((day) => {
    const isToday = day === today;
    const isRunning = runningDays.includes(day);
    return {
      value: day,
      title: `${DAY_NAMES[day]}${isToday ? " (today)" : ""}${isRunning ? ", timer running" : ""}`,
      label: (
        <span className={isToday ? styles.today : styles.day}>
          {DAY_LABELS[day]}
          {isToday && <span className={styles.sr_only}> (today)</span>}
          {isRunning && (
            <>
              <span className={styles.running_dot} aria-hidden="true" />
              <span className={styles.sr_only}>, timer running</span>
            </>
          )}
        </span>
      ),
    };
  });

  return (
    <div className={styles.bar}>
      <Segmented
        block
        aria-label="Day of the week"
        size={isMobile ? "large" : "middle"}
        className={styles.day_picker}
        options={options}
        value={selectedDay}
        onChange={setSelectedDay}
      />
    </div>
  );
}

export default DayPicker;
