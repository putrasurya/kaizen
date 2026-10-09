/* eslint-disable react-hooks/exhaustive-deps */
import { Typography, Space, Tooltip } from "antd";
import { useCallback, useEffect, useState, useRef } from "react";
import { millisToSeconds, secondsToMillis, extractToHourMinuteAndSecondWithPadZero } from "../utilities/time-helper";

const { Title } = Typography;

// A countdown clock. It reports progress (`onProgress(seconds)`) and when it
// reaches zero (`onFinish()`); what happens next (buzz, +1 rep, a break,
// back to full time) is up to the timer card.
//
// How it keeps time:
// - While playing, elapsed time always comes from the clock (when it started
//   plus how much was already spent), never from counting ticks. Browsers slow
//   down or pause timers in hidden tabs and locked phones, so ticks are only
//   for redrawing.
// - There's one scheduled tick at a time, aimed at the next whole second.
// - Coming back to the app (tab visible, window focus, page restored) redraws
//   straight away instead of waiting for a slowed-down tick.
// - Progress is reported when the app goes to the background, on pause, and
//   at least once a minute while running, so a reload loses little.
export default function Countdown({ play, seconds, secondsSpent, onProgress, onFinish, className }) {
  const [spentMs, setSpentMs] = useState(() => secondsToMillis(secondsSpent || 0));
  const run = useRef(null); // { startedAt, baseMs } while playing
  const timer = useRef();
  const lastSaved = useRef(secondsSpent || 0);
  const latest = useRef();
  latest.current = { seconds, onProgress, onFinish };

  const elapsed = () => run.current.baseMs + (Date.now() - run.current.startedAt);

  const save = (secs) => {
    lastSaved.current = secs;
    latest.current.onProgress?.(secs);
  };

  const tick = useCallback(() => {
    clearTimeout(timer.current);
    if (!run.current) return;
    const total = secondsToMillis(latest.current.seconds);
    const ms = elapsed();

    if (ms >= total) {
      run.current = null;
      setSpentMs(total);
      latest.current.onFinish?.();
      return;
    }

    setSpentMs(ms);
    const secs = millisToSeconds(ms);
    if (secs - lastSaved.current >= 60) save(secs);
    timer.current = setTimeout(tick, 1000 - (ms % 1000) + 5);
  }, []);

  // Play starts a run from the saved progress; pause ends it and saves.
  useEffect(() => {
    if (play) {
      run.current = { startedAt: Date.now(), baseMs: secondsToMillis(secondsSpent || 0) };
      lastSaved.current = secondsSpent || 0;
      tick();
    } else if (run.current) {
      const ms = elapsed();
      run.current = null;
      clearTimeout(timer.current);
      setSpentMs(ms);
      save(millisToSeconds(ms));
    }
  }, [play]);

  // While paused, the display follows the saved progress: on first render
  // (including when the browser reloads the app after it was in the
  // background), after a reset, and whenever progress is saved.
  useEffect(() => {
    if (!run.current) setSpentMs(secondsToMillis(secondsSpent || 0));
  }, [secondsSpent, seconds]);

  useEffect(() => {
    const redraw = () => {
      if (document.visibilityState !== "hidden") tick();
    };
    const saveNow = () => {
      if (run.current) save(millisToSeconds(elapsed()));
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? saveNow() : redraw());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", redraw);
    window.addEventListener("pageshow", redraw);
    window.addEventListener("pagehide", saveNow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", redraw);
      window.removeEventListener("pageshow", redraw);
      window.removeEventListener("pagehide", saveNow);
      clearTimeout(timer.current);
    };
  }, [tick]);

  const secondsLeft = Math.max(0, seconds - millisToSeconds(spentMs));
  const [hour, minute, second] = extractToHourMinuteAndSecondWithPadZero(secondsLeft);
  const [originHour, originMinute] = extractToHourMinuteAndSecondWithPadZero(seconds);

  return (
    <Space>
      <Tooltip title={`${hour}.${minute} / ${originHour}.${originMinute}`}>
        <Title level={3} className={className}>
          {hour}.{minute}
          <small style={{ fontWeight: 300, fontSize: "0.7em" }}>.{second}</small>
        </Title>
      </Tooltip>
    </Space>
  );
}
