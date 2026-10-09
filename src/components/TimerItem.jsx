import { useContext, useEffect, useState } from "react";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Grid, Row, Space, Modal, Tag, Typography } from "antd";
import TimerCountdown from "./TimerCountdown";
import { store } from "../redux/store";
import { useDay } from "../redux/day";
import { toDateKey, weekDateOf } from "../utilities/day-helper";
import { breakAfter, cyclePosition } from "../utilities/pomodoro";
import { buzz, unlockAlarm } from "../utilities/buzz";
import styles from "./TimerItem.module.css";
import TimerItemReps from "./TimerItemReps";
import TimerCopy from "./TimerCopy";
import TimerForm from "./TimerForm";

// One timer. At zero it buzzes, adds a rep for today and goes back to full
// time, ready for the next round. With Pomodoro on, a break follows each
// round (a long one every few rounds), started automatically or by play.
function TimerItem({ timer, onPlayChange }) {
  const { deleteTimer, updateSecondsSpent, incrementReps, editTimer } = useContext(store);
  const { today, todayDate } = useDay();
  const [play, setPlay] = useState(false);
  const [phase, setPhase] = useState("focus"); // "focus" | "break"
  const [pause, setPause] = useState(null); // { seconds, long } during a break
  const [breakSpent, setBreakSpent] = useState(0);
  // Bumped after each finished round so the focus clock starts fresh at full
  // time, even if the saved progress was already 0.
  const [round, setRound] = useState(0);
  const [showCopy, setShowCopy] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  // Phones: title on its own line, countdown + controls spread across the next
  // one, with larger buttons for touch.
  const isMobile = !!Grid.useBreakpoint().xs;
  const buttonSize = isMobile ? "large" : "middle";
  const onBreak = phase === "break";

  // Lets the list know which timers are running (e.g. to mark their day).
  useEffect(() => {
    onPlayChange?.(timer.id, play);
  }, [play]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pomodoro switched off mid-break: back to focus.
  useEffect(() => {
    if (!timer.pomodoro && onBreak) endBreak();
  }, [timer.pomodoro]); // eslint-disable-line react-hooks/exhaustive-deps

  const endBreak = () => {
    setPlay(false);
    setPhase("focus");
    setPause(null);
    setBreakSpent(0);
  };

  const finishRound = () => {
    buzz();
    const date = toDateKey();
    incrementReps(timer.id, date);
    updateSecondsSpent(timer.id, 0);
    setRound((r) => r + 1);
    if (!timer.pomodoro) {
      setPlay(false);
      return;
    }
    setPause(breakAfter(timer.pomodoro, (timer.repsOn?.[date] ?? 0) + 1));
    setBreakSpent(0);
    setPhase("break");
    setPlay(timer.pomodoro.autoBreak);
  };

  const finishBreak = () => {
    buzz();
    endBreak();
  };

  const togglePlay = () => {
    unlockAlarm();
    setPlay(!play);
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: "delete timer?",
      onOk: () => deleteTimer(id),
    });
  };

  const handleReset = (timer) => {
    Modal.confirm({
      title: "Start this round over?",
      content: "Reps you've finished stay counted.",
      onOk: () => updateSecondsSpent(timer.id, 0),
    });
  };

  const repsDate = timer.day === today ? todayDate : weekDateOf(timer.day, todayDate);
  const filled = timer.pomodoro ? cyclePosition(timer.pomodoro, timer.repsOn?.[repsDate] ?? 0) : 0;

  return (
    <Card className={play ? styles.timer_play : styles.timer_pause} size="small">
      <Row justify="space-between" align="middle" wrap={isMobile}>
        <Col flex={isMobile ? "1 1 100%" : "auto"} className={styles.info}>
          <div className={styles.titleRow}>
            <Typography.Text ellipsis className={styles.title}>{timer.title}</Typography.Text>
            {timer.pomodoro && (
              <Tag color={onBreak ? "green" : play ? "blue" : undefined} className={styles.phase} data-testid={`phase-${timer.id}`}>
                {onBreak ? (pause.long ? "Long break" : "Break") : play ? "Focus" : "Ready"}
              </Tag>
            )}
          </div>
          <TimerItemReps timer={timer} />
          {timer.pomodoro && (
            <span
              className={styles.dots}
              role="img"
              aria-label={`${filled} of ${timer.pomodoro.longEvery} rounds before the long break`}
            >
              {Array.from({ length: timer.pomodoro.longEvery }, (_, i) => (
                <span key={i} className={`${styles.dot} ${i < filled ? styles.dotOn : ""}`} />
              ))}
            </span>
          )}
        </Col>
        <Col flex={isMobile ? "1 1 100%" : "none"}>
          <Space
            align="center"
            size="middle"
            className={isMobile ? styles.controls_mobile : undefined}
          >
            {onBreak ? (
              <TimerCountdown
                key="break"
                play={play}
                seconds={pause.seconds}
                secondsSpent={breakSpent}
                onProgress={setBreakSpent}
                onFinish={finishBreak}
                className={play ? styles.countdown_break : styles.countdown_pause}
              />
            ) : (
              <TimerCountdown
                key={`focus-${round}`}
                play={play}
                seconds={timer.seconds}
                secondsSpent={timer.secondsSpent}
                onProgress={(secs) => updateSecondsSpent(timer.id, secs)}
                onFinish={finishRound}
                className={play ? styles.countdown_play : styles.countdown_pause}
              />
            )}
            <Space size="small">
              <Button
                type={play ? "primary" : "default"}
                icon={play ? <PauseCircleFilled /> : <PlayCircleFilled />}
                shape="circle"
                size={buttonSize}
                aria-label={play ? "Pause" : onBreak ? "Start break" : "Start"}
                onClick={togglePlay}
              />
              <div>
                {onBreak ? (
                  <Button size={isMobile ? "middle" : "small"} onClick={endBreak}>
                    Skip break
                  </Button>
                ) : (
                  <>
                    <Button
                      type="link"
                      size={buttonSize}
                      icon={<EditOutlined />}
                      title="Edit timer"
                      aria-label="Edit timer"
                      disabled={play}
                      onClick={() => setShowEdit(true)}
                    />
                    <Button
                      type="link"
                      size={buttonSize}
                      icon={<CopyOutlined />}
                      title="Copy to other days"
                      onClick={() => setShowCopy(true)}
                    />
                    <Button
                      type="link"
                      size={buttonSize}
                      disabled={play}
                      icon={<UndoOutlined />}
                      title="Start this round over"
                      aria-label="Start this round over"
                      onClick={() => handleReset(timer)}
                    />
                    <Button
                      type="link"
                      size={buttonSize}
                      danger
                      disabled={play}
                      icon={<DeleteOutlined />}
                      title="Delete timer"
                      aria-label="Delete timer"
                      onClick={() => handleDelete(timer.id)}
                    />
                  </>
                )}
              </div>
            </Space>
          </Space>
        </Col>
      </Row>
      <TimerCopy timer={timer} open={showCopy} onClose={() => setShowCopy(false)} />
      <TimerForm
        open={showEdit}
        title="Edit timer"
        okText="Save"
        timer={timer}
        onSubmit={(settings) => editTimer(timer.id, settings)}
        onClose={() => setShowEdit(false)}
      />
    </Card>
  );
}

export default TimerItem;
