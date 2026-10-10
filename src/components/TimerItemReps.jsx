import { Tooltip, Typography } from "antd";
import { useDay } from "../redux/day";
import { DAY_LABELS, weekDateOf } from "../utilities/day-helper";
import styles from "./TimerItemReps.module.css";

// "1 h 40 min", "25 min", "45 s"
export function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return `${totalSeconds} s`;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
}

// Rounds finished on this timer's day (this week), e.g. "4 🍅 today · 1 h 40 min
// focused". Reps only ever go up; each day simply starts at 0 again. The
// all-time total is in the tooltip.
function TimerItemReps({ timer }) {
  const { today, todayDate } = useDay();
  const isToday = timer.day === today;
  const date = isToday ? todayDate : weekDateOf(timer.day, todayDate);
  const count = timer.repsOn?.[date] ?? 0;
  const when = isToday ? "today" : `on ${DAY_LABELS[timer.day]}`;
  const unit = timer.pomodoro ? "🍅" : count === 1 ? "rep" : "reps";
  const time = count ? ` · ${formatDuration(count * timer.seconds)}${timer.pomodoro ? " focused" : ""}` : "";

  return (
    <Tooltip title={`${timer.reps} in total`}>
      <Typography.Text type="secondary" className={styles.item_reps} data-testid={`reps-${timer.id}`}>
        {count} {unit} {when}
        {time}
      </Typography.Text>
    </Tooltip>
  );
}

export default TimerItemReps;
