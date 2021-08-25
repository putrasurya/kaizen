import { Typography, Space } from "antd";
import { useEffect, useState, useRef, useContext } from "react";
import { store } from "../redux/store";

const { Title } = Typography;

function Countdown({ id, play, seconds, secondsSpent }) {
  const { updateSecondsSpent } = useContext(store);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  const [second, setSecond] = useState(0);
  const spent = useRef((secondsSpent || 0) * 1000);
  const timeStart = useRef(null);

  useEffect(() => {
    if (timeStart.current === null && play) {
      timeStart.current = new Date();
    }

    if (false === play) {
      timeStart.current = null;
      updateSecondsSpent(id, Math.floor(spent.current / 1000));
    }

    function tiktok() {
      if (spent.current > seconds * 1000) return;

      const secs = seconds - Math.floor(spent.current / 1000);
      const h = Math.floor(secs / 3600);
      const m = Math.floor((secs % 3600) / 60);
      const s = secs % 60;

      setHour((_) => h);
      setMinute((_) => String(m).padStart(2, "0"));
      setSecond((_) => String(s).padStart(2, "0"));

      if (!play) return;

      const accumulation = new Date().getTime() - timeStart.current.getTime();
      spent.current = secondsSpent * 1000 + accumulation;

      if (Math.floor(spent.current / 1000) % 60 === 0) {
        updateSecondsSpent(id, Math.floor(spent.current / 1000));
      }
    }
    tiktok();

    let interval = setInterval(tiktok, 1000);

    return () => clearInterval(interval);
  }, [play]);

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
