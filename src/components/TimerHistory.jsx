import { useContext, useMemo, useRef, useState } from "react";
import { Grid, Modal, Typography } from "antd";
import { store } from "../redux/store";
import { useDay } from "../redux/day";
import { DAYS, DAY_LABELS } from "../utilities/day-helper";
import {
  addDays,
  entryOn,
  firstDate,
  focusKey,
  isDone,
  level,
  mondayOf,
  plannedDays,
  secondsBetween,
  streak,
  weekdayOf,
} from "../utilities/focus";
import { formatDuration } from "./TimerItemReps";
import styles from "./TimerHistory.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const dayNumber = (date) => Number(date.slice(8));
const monthOf = (date) => MONTHS[Number(date.slice(5, 7)) - 1];
const longDate = (date) => `${DAY_LABELS[weekdayOf(date)]} ${dayNumber(date)} ${monthOf(date)}`;

// "Mon to Fri", "Mon, Wed, Fri", "every day"
function plannedText(planned) {
  const days = DAYS.filter((day) => planned.has(day));
  if (days.length === 7) return "every day";
  if (!days.length) return "on no day";
  const first = DAYS.indexOf(days[0]);
  const consecutive = days.length > 2 && days.every((day, i) => DAYS.indexOf(day) === first + i);
  if (consecutive) return `${DAY_LABELS[days[0]]} to ${DAY_LABELS[days[days.length - 1]]}`;
  return days.map((day) => DAY_LABELS[day]).join(", ");
}

function weekChange(diff) {
  if (!diff) return "same as last week";
  return `${diff > 0 ? "+" : "−"}${formatDuration(Math.abs(diff))} vs last week`;
}

function Stat({ label, value, note, tone }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {note && <div className={tone === "up" ? styles.statUp : styles.statNote}>{note}</div>}
    </div>
  );
}

// One activity's focus history (every timer with this name): a heatmap of
// time focused per day, where days it isn't planned on look different from
// planned days that were missed.
function TimerHistory({ open, timer, onClose }) {
  const { focus, timers } = useContext(store);
  const { todayDate } = useDay();
  const isMobile = !!Grid.useBreakpoint().xs;
  const weeks = isMobile ? 12 : 52;
  const [selected, setSelected] = useState(todayDate);
  const gridRef = useRef();

  const key = focusKey(timer.title);
  const planned = useMemo(() => plannedDays(timers, key), [timers, key]);
  const start = firstDate(focus, key);

  const gridStart = addDays(mondayOf(todayDate), -(weeks - 1) * 7);
  const thisMonday = mondayOf(todayDate);

  const describe = (date) => {
    const entry = entryOn(focus, key, date);
    const isPlanned = planned.has(weekdayOf(date));
    if (entry.seconds || entry.rounds) {
      const rounds = `${entry.rounds} ${entry.rounds === 1 ? "round" : "rounds"}`;
      return `${longDate(date)}: ${formatDuration(entry.seconds)} focused, ${rounds}${isPlanned ? "" : " (extra day)"}`;
    }
    if (!isPlanned) return `${longDate(date)}: not planned`;
    if (!start || date < start) return `${longDate(date)}: before your history starts`;
    if (date === todayDate) return `${longDate(date)}: nothing yet today`;
    return `${longDate(date)}: planned, nothing done`;
  };

  // Planned days in view (from the first logged day on, today only once done).
  let plannedCount = 0;
  let doneCount = 0;
  if (start) {
    for (let date = start > gridStart ? start : gridStart; date <= todayDate; date = addDays(date, 1)) {
      if (!planned.has(weekdayOf(date))) continue;
      const done = isDone(entryOn(focus, key, date));
      if (date === todayDate && !done) continue;
      plannedCount++;
      if (done) doneCount++;
    }
  }

  const days = streak(focus, key, planned, todayDate);
  const thisWeek = secondsBetween(focus, key, thisMonday, todayDate);
  const lastWeek = secondsBetween(focus, key, addDays(thisMonday, -7), addDays(thisMonday, -1));

  // Arrow keys move one day (up/down) or one week (left/right).
  const move = (event) => {
    const step = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = addDays(selected, step);
    if (next < gridStart || next > todayDate) return;
    setSelected(next);
    gridRef.current?.querySelector(`[data-date="${next}"]`)?.focus();
  };

  const cells = [];
  for (let row = 0; row < 7; row++) {
    cells.push(
      <span key={`label-${row}`} className={styles.dayLabel} aria-hidden="true">
        {row % 2 === 0 ? DAY_LABELS[DAYS[row]] : ""}
      </span>
    );
    for (let week = 0; week < weeks; week++) {
      const date = addDays(gridStart, week * 7 + row);
      if (date > todayDate) {
        cells.push(<span key={date} className={styles.future} />);
        continue;
      }
      const entry = entryOn(focus, key, date);
      const logged = entry.seconds || entry.rounds;
      const counts = planned.has(weekdayOf(date)) && start && date >= start;
      const kind = logged ? `l${Math.max(1, level(entry.seconds))}` : counts ? "l0" : "off";
      cells.push(
        <button
          key={date}
          type="button"
          data-date={date}
          data-level={kind}
          className={`${styles.cell} ${styles[kind]} ${date === todayDate ? styles.today : ""} ${date === selected ? styles.selected : ""}`}
          aria-label={describe(date)}
          aria-pressed={date === selected}
          tabIndex={date === selected ? 0 : -1}
          onClick={() => setSelected(date)}
        />
      );
    }
  }

  const monthLabels = [<span key="corner" />];
  for (let week = 0; week < weeks; week++) {
    const monday = addDays(gridStart, week * 7);
    const show = week === 0 ? dayNumber(monday) <= 21 : dayNumber(monday) <= 7;
    monthLabels.push(
      <span key={monday} className={styles.monthLabel} aria-hidden="true">
        {show ? monthOf(monday) : ""}
      </span>
    );
  }

  const columns = { gridTemplateColumns: `28px repeat(${weeks}, minmax(0, 1fr))` };

  return (
    <Modal open={open} onCancel={onClose} footer={null} width={760} title={`${timer.title.trim()} history`} destroyOnHidden>
      <Typography.Text type="secondary">Planned {plannedText(planned)}</Typography.Text>

      <div className={styles.stats}>
        <Stat label="Streak" value={`${days} ${days === 1 ? "day" : "days"}`} />
        <Stat
          label="This week"
          value={formatDuration(thisWeek)}
          note={weekChange(thisWeek - lastWeek)}
          tone={thisWeek > lastWeek ? "up" : undefined}
        />
        <Stat label="Planned days done" value={`${doneCount} of ${plannedCount}`} note={`last ${weeks} weeks`} />
      </div>

      {!start && (
        <Typography.Paragraph type="secondary" className={styles.empty}>
          No history yet. Finish a round and today turns green.
        </Typography.Paragraph>
      )}

      <div className={styles.months} style={columns}>
        {monthLabels}
      </div>
      <div
        ref={gridRef}
        className={styles.grid}
        style={columns}
        role="group"
        aria-label={`Focus per day, last ${weeks} weeks`}
        onKeyDown={move}
      >
        {cells}
      </div>

      <div className={styles.footer}>
        <div className={styles.detail} aria-live="polite" data-testid="history-detail">
          {describe(selected)}
        </div>
        <div className={styles.legend} aria-hidden="true">
          <span>Not planned</span>
          <span className={`${styles.swatch} ${styles.off}`} />
          <span className={styles.gap}>Less</span>
          {["l0", "l1", "l2", "l3", "l4"].map((kind) => (
            <span key={kind} className={`${styles.swatch} ${styles[kind]}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </Modal>
  );
}

export default TimerHistory;
