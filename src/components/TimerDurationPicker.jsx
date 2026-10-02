import { InputNumber, Radio } from "antd";
import { useId } from "react";
import { extractToHourMinuteAndSecond } from "../utilities/time-helper";
import styles from "./TimerDurationPicker.module.css";

export const MAX_HOURS = 12;

// Quick picks for focus blocks, Pomodoro sessions and breaks, in seconds.
const PRESETS = [5, 10, 15, 25, 30, 45, 60, 90].map((minutes) => minutes * 60);

function pluralize(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

// "1 hour 30 minutes", for screen readers and tooltips.
function describe(seconds) {
  const [hours, minutes] = extractToHourMinuteAndSecond(seconds);
  if (hours && minutes) return `${pluralize(hours, "hour")} ${pluralize(minutes, "minute")}`;
  if (hours) return pluralize(hours, "hour");
  return pluralize(minutes, "minute");
}

// "1h 30m", for the preset chips.
function shortLabel(seconds) {
  const [hours, minutes] = extractToHourMinuteAndSecond(seconds);
  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

// A Form control: `value` is the duration in whole seconds, as stored on a timer.
// Preset chips cover the common lengths; the hour/minute steppers set anything
// else. Either one updates the large readout at the top.
function TimerDurationPicker({ id, value = 0, onChange }) {
  const baseId = useId();
  const [hours, minutes] = extractToHourMinuteAndSecond(value);

  const change = (nextHours, nextMinutes) => {
    onChange?.(nextHours * 60 * 60 + nextMinutes * 60);
  };

  const presetOptions = PRESETS.map((seconds) => ({
    value: seconds,
    title: describe(seconds),
    label: (
      <>
        <span aria-hidden="true">{shortLabel(seconds)}</span>
        <span className={styles.sr_only}>{describe(seconds)}</span>
      </>
    ),
  }));

  return (
    <div id={id} className={styles.picker}>
      <div className={styles.readout}>
        <div aria-hidden="true">
          {hours > 0 && (
            <span className={styles.part}>
              <span className={styles.number}>{hours}</span>
              <span className={styles.unit}>h</span>
            </span>
          )}
          {(minutes > 0 || hours === 0) && (
            <span className={styles.part}>
              <span className={styles.number}>{minutes}</span>
              <span className={styles.unit}>min</span>
            </span>
          )}
        </div>
        <div role="status" className={styles.sr_only}>
          Duration: {describe(value)}
        </div>
      </div>

      <Radio.Group
        aria-label="Quick durations"
        className={styles.presets}
        options={presetOptions}
        optionType="button"
        buttonStyle="solid"
        // Only light up a chip when the steppers land exactly on it.
        value={PRESETS.includes(value) ? value : null}
        onChange={(event) => onChange?.(event.target.value)}
      />

      <div className={styles.custom}>
        <div className={styles.field}>
          <label htmlFor={`${baseId}-hours`} className={styles.label}>Hours</label>
          <InputNumber
            id={`${baseId}-hours`}
            className={styles.stepper}
            mode="spinner"
            inputMode="numeric"
            min={0}
            max={MAX_HOURS}
            precision={0}
            value={hours}
            onChange={(next) => change(next ?? 0, minutes)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor={`${baseId}-minutes`} className={styles.label}>Minutes</label>
          <InputNumber
            id={`${baseId}-minutes`}
            className={styles.stepper}
            mode="spinner"
            inputMode="numeric"
            min={0}
            max={59}
            step={5}
            precision={0}
            value={minutes}
            onChange={(next) => change(hours, next ?? 0)}
          />
        </div>
      </div>
    </div>
  );
}

export default TimerDurationPicker;
