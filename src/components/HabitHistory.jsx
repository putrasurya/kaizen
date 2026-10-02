import { Modal, theme, Typography } from "antd";
import {
  balanceLabel,
  dailyWeek,
  recentWeekStarts,
  routineWeek,
  shortDate,
  weekDates,
} from "../utilities/habit-helper";
import { DAYS, DAY_LABELS } from "../utilities/day-helper";
import styles from "./HabitHistory.module.css";

const { Text } = Typography;

// Daily: one row per week, one cell per day, stronger colour = more slots
// filled. Shows which weekdays tend to slip and whether the week score climbs.
function DailyHistory({ habit, weeks, todayDate, token }) {
  const rows = weeks.map((start) => ({ start, ...dailyWeek(habit, start), dates: weekDates(start) }));
  const summary = rows.map((row) => `Week of ${shortDate(row.start)}: ${row.done} of ${row.possible}`).join(". ");
  const weekWord = weeks.length === 1 ? "week" : `${weeks.length} weeks`;

  const cellColor = (count) =>
    count === 0
      ? token.colorFillSecondary
      : // Squared, so the top steps (4 vs 5 of 5) are still easy to tell apart.
        `color-mix(in srgb, ${token.colorPrimary} ${Math.round(20 + 80 * (count / habit.target) ** 2)}%, transparent)`;

  return (
    <div role="img" aria-label={`${habit.name}, last ${weekWord}. ${summary}.`}>
      <div className={styles.heatmap} aria-hidden="true">
        <span />
        {DAYS.map((day) => (
          <Text key={day} type="secondary" className={styles.dayHead}>
            {DAY_LABELS[day].slice(0, 1)}
          </Text>
        ))}
        <span />
        {rows.map((row) => (
          <div key={row.start} className={styles.heatRow}>
            <Text type="secondary" className={styles.weekLabel}>
              {shortDate(row.start)}
            </Text>
            {row.dates.map((date, i) => {
              const future = date > todayDate;
              return (
                <span
                  key={date}
                  data-testid={`cell-${date}`}
                  title={future ? undefined : `${shortDate(date)}: ${row.counts[i]}/${habit.target}`}
                  className={styles.cell}
                  style={
                    future
                      ? { border: `1px dashed ${token.colorBorder}` }
                      : { background: cellColor(row.counts[i]) }
                  }
                />
              );
            })}
            <Text className={styles.score}>
              {row.done}/{row.possible}
            </Text>
          </div>
        ))}
      </div>
    </div>
  );
}

// Routine: each bar is the week's closing balance. Below the line = ended the
// week owing; above = ahead. The goal is bars moving from red to blue.
function RoutineHistory({ habit, weeks, token }) {
  const rows = weeks.map((start) => ({ start, ...routineWeek(habit, start) }));
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.balance)));
  const summary = rows.map((row) => `Week of ${shortDate(row.start)}: ${balanceLabel(row.balance)}`).join(". ");
  const weekWord = weeks.length === 1 ? "week" : `${weeks.length} weeks`;

  return (
    <div role="img" aria-label={`${habit.name}, last ${weekWord}. ${summary}.`}>
      <div className={styles.bars} aria-hidden="true">
        {rows.map((row) => {
          const height = `${(Math.abs(row.balance) / max) * 100}%`;
          const color = row.balance < 0 ? token.colorError : token.colorPrimary;
          return (
            <div
              key={row.start}
              className={styles.barCol}
              title={`${shortDate(row.start)}: ${balanceLabel(row.balance)} (+${row.plus} / -${row.minus})`}
            >
              <div className={styles.half}>
                {row.balance > 0 && <span className={styles.barUp} style={{ height, background: color }} />}
              </div>
              <div className={styles.zero} style={{ background: token.colorBorder }} />
              <div className={styles.half}>
                {row.balance < 0 && <span className={styles.barDown} style={{ height, background: color }} />}
              </div>
              <Text type="secondary" className={styles.barValue}>
                {row.balance > 0 ? `+${row.balance}` : row.balance}
              </Text>
              <Text type="secondary" className={styles.barLabel}>
                {shortDate(row.start)}
              </Text>
            </div>
          );
        })}
      </div>
      <div className={styles.legend} aria-hidden="true">
        <span>
          <i style={{ background: token.colorError }} /> Owed
        </span>
        <span>
          <i style={{ background: token.colorPrimary }} /> Ahead
        </span>
      </div>
    </div>
  );
}

function HabitHistory({ habit, todayDate, onClose }) {
  const { token } = theme.useToken();
  const weeks = recentWeekStarts(todayDate, undefined, habit.createdOn);

  return (
    <Modal open title={`${habit.name}: history`} footer={null} onCancel={onClose}>
      <Text type="secondary" className={styles.caption}>
        {habit.kind === "daily"
          ? "Slots filled each day. Each week starts fresh on Monday."
          : "Balance at the end of each week, Monday to Sunday."}
      </Text>
      {habit.kind === "daily" ? (
        <DailyHistory habit={habit} weeks={weeks} todayDate={todayDate} token={token} />
      ) : (
        <RoutineHistory habit={habit} weeks={weeks} token={token} />
      )}
    </Modal>
  );
}

export default HabitHistory;
