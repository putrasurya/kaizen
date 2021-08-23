import { Typography, Space } from "antd";
import { useEffect, useState, useRef } from "react";

const { Title } = Typography;

function Countdown({ taskHook, task }) {
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [second, setSecond] = useState(59);

  useEffect(() => {
    const timeleft = task.minutes - task.minutesSpent;
    setHour(Math.floor(timeleft / 60));
    setMinute(String(timeleft % 60).padStart(2, "0"));
  }, [task]);

  useEffect(() => {
    if (
      (task.minutes <= task.minutesSpent && second <= 0) ||
      false === task.play
    ) {
      return;
    }
    if (second <= 0) {
      setSecond(59);
      taskHook.oneMinuteSpent(task.id);
    }
    setTimeout(() => {
      setSecond((sec) => --sec);
    }, 1000);
  }, [second, task, taskHook]);

  return (
    <Space>
      <Title level={3} className="no-margin-important">
        {hour}.{minute}
        <small style={{ fontWeight: 300, fontSize: "0.7em" }}>.{second}</small>
      </Title>
    </Space>
  );
}

export default Countdown;
