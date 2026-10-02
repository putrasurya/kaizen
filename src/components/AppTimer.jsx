import { Row, Typography } from "antd";
import { useContext } from "react";
import TimerAdd from "./TimerAdd";
import TimerItem from "./TimerItem";
import { store } from "../redux/store";
import { useDay } from "../redux/day";

const { Title, Text } = Typography;

function AppTimer() {
  const { timers } = useContext(store);
  // The viewed day is shared with the todos and notes (see DayPicker).
  const { selectedDay, setTimerRunning } = useDay();

  const dayTimers = timers.filter((timer) => timer.day === selectedDay);

  const totalHour = () => {
    const secsInitial = dayTimers.reduce((acc, cur) => acc + cur.seconds, 0);
    const secsSpent = dayTimers.reduce((acc, cur) => acc + cur.secondsSpent, 0);
    const secs = secsInitial - secsSpent;
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    return `${hours}.${minutes} Times left`;
  };

  return (
    <section aria-label="Timers">
      {/* Top padding matches the List headers of Todo / Take Note, so the
          section titles line up side by side on desktop. */}
      <Row justify="space-between" align="middle" className="margin-bottom-1" style={{ paddingTop: 12 }}>
        <Title level={3} style={{ fontWeight: 300 }} className="no-margin-important">
          Timers
        </Title>
        <Text style={{ fontSize: 16 }}>{totalHour()}</Text>
      </Row>
      <TimerAdd day={selectedDay} />
      {/* Every timer stays mounted and other days' are only hidden, so a
          running countdown (and its alarm) keeps going while another day is
          being viewed. */}
      {timers.map((timer) => (
        <div key={timer.id} hidden={timer.day !== selectedDay}>
          <TimerItem timer={timer} onPlayChange={setTimerRunning} />
        </div>
      ))}
    </section>
  );
}

export default AppTimer;
