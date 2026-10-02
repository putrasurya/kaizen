import { Col, Divider, Row, Space, Tooltip, Typography } from "antd";
import { useCallback, useContext, useEffect, useState } from "react";
import TimerAdd from "./TimerAdd";
import TimerItem from "./TimerItem";
import TimerDayPicker from "./TimerDayPicker";
import { store } from "../redux/store";
import { getTodayKey } from "../utilities/day-helper";
import styles from "./AppTimer.module.css";

const { Title, Text } = Typography;

function AppTimer() {
  const { timers } = useContext(store);
  // Always opens on today; the picked day is deliberately not persisted.
  const [today, setToday] = useState(getTodayKey);
  const [selectedDay, setSelectedDay] = useState(today);
  const [runningIds, setRunningIds] = useState(() => new Set());

  // Jump back to today when the date rolls over, whether the app stayed open
  // past midnight or comes back from the background.
  useEffect(() => {
    const checkDay = () => {
      const now = getTodayKey();
      if (now === today) return;
      setToday(now);
      setSelectedDay(now);
    };
    const interval = setInterval(checkDay, 60 * 1000);
    document.addEventListener("visibilitychange", checkDay);
    window.addEventListener("focus", checkDay);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", checkDay);
      window.removeEventListener("focus", checkDay);
    };
  }, [today]);

  const handlePlayChange = useCallback((id, play) => {
    setRunningIds((ids) => {
      if (ids.has(id) === play) return ids;
      const next = new Set(ids);
      if (play) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const dayTimers = timers.filter((timer) => timer.day === selectedDay);
  const runningDays = timers.filter((timer) => runningIds.has(timer.id)).map((timer) => timer.day);

  const totalHour = () => {
    const secsInitial = dayTimers.reduce((acc, cur) => acc + cur.seconds, 0);
    const secsSpent = dayTimers.reduce((acc, cur) => acc + cur.secondsSpent, 0);
    const secs = secsInitial - secsSpent;
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    return `${hours}.${minutes} Times left`;
  };

  const hourLeftForToday = () => {
    return 24 - new Date().getHours();
  };

  return (
    <>
      <Row justify="space-between" align="middle">
        <Col>
          <Title level={2} style={{ fontWeight: 300 }}>
            Kaizen
          </Title>
        </Col>
        <Col>
          <Space align="end">
            <Title
              level={4}
              style={{ fontWeight: 400 }}
              className="no-margin-important"
            >
              {totalHour()}
            </Title>
            <Divider orientation="vertical" className={styles.hide_on_mobile} />
            <Tooltip title="Represent times left from 24 hours of today" className={styles.hide_on_mobile}>
              <Text>{hourLeftForToday()}h/24h</Text>
            </Tooltip>
          </Space>
        </Col>
      </Row>
      <TimerDayPicker
        value={selectedDay}
        today={today}
        runningDays={runningDays}
        onChange={setSelectedDay}
      />
      <TimerAdd day={selectedDay} />
      {/* Every timer stays mounted and other days' are only hidden, so a
          running countdown (and its alarm) keeps going while another day is
          being viewed. */}
      {timers.map((timer) => (
        <div key={timer.id} hidden={timer.day !== selectedDay}>
          <TimerItem timer={timer} onPlayChange={handlePlayChange} />
        </div>
      ))}
    </>
  );
}

export default AppTimer;
