import { Grid, Segmented } from "antd";
import { DAYS, DAY_LABELS, DAY_NAMES } from "../utilities/day-helper";
import styles from "./TimerDayPicker.module.css";

// Mon..Sun switcher for the timers column. Today gets an underline, and days
// with a running timer get a dot, since those timers are hidden while another
// day is being viewed.
function TimerDayPicker({ value, today, runningDays = [], onChange }) {
  const isMobile = !!Grid.useBreakpoint().xs;

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
    <Segmented
      block
      aria-label="Day of the week"
      size={isMobile ? "large" : "middle"}
      className={styles.day_picker}
      options={options}
      value={value}
      onChange={onChange}
    />
  );
}

export default TimerDayPicker;
