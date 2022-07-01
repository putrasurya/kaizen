/* eslint-disable react-hooks/exhaustive-deps */
import { Typography, Space } from "antd";
import { useEffect, useState, useRef, useContext } from "react";
import { store } from "../redux/store";

const { Title } = Typography;

function Buzz() {
  const audio = document.createElement('audio');
  audio.src = `${process.env.REACT_APP_BUZZ_WAV}`;
  audio.autoplay = true;
  audio.hidden = true;
  audio.volume = 1;
  audio.onended = function () {
    audio.remove();
  }
  document.getElementById("root").append(audio);
}

function Countdown({ id, play, seconds, secondsSpent, setPlay, className }) {
  const { updateSecondsSpent } = useContext(store);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState("00");
  const [second, setSecond] = useState("00");
  const spent = useRef((secondsSpent || 0) * 1000);
  const timeStart = useRef(null);

  useEffect(() => {
    if (false === play) {
      timeStart.current = null;
      updateSecondsSpent(id, Math.floor(spent.current / 1000));
    } else {
      timeStart.current = new Date();
    }
    tiktok();
  }, [play]);

  useEffect(() => {
    if (secondsSpent === 0 && false === play) {
      timeStart.current = new Date();
      spent.current = 0;
      tiktok();
    }
  }, [secondsSpent])

  function tiktok() {
    if (spent.current >= seconds * 1000) {
      if (spent.current > seconds * 1000) {
        setHour((_) => 0);
        setMinute((_) => String("00"));
        setSecond((_) => String("00"));
        updateSecondsSpent(id, seconds);
        if (play === true) {
          Buzz();
        }
        setPlay(false);
      }
      return;
    }

    const secs = seconds - Math.floor(spent.current / 1000);
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;

    setHour((_) => h);
    setMinute((_) => String(m).padStart(2, "0"));
    setSecond((_) => String(s).padStart(2, "0"));

    if (!play || null === timeStart.current) return;

    const accumulation = new Date().getTime() - timeStart.current.getTime();
    spent.current = secondsSpent * 1000 + accumulation;

    if (Math.floor(spent.current / 1000) % 60 === 0) {
      updateSecondsSpent(id, Math.floor(spent.current / 1000));
    }

    setTimeout(() => tiktok(), 1000);
  }

  return (
    <Space>
      <Title level={3} className={className}>
        {hour}.{minute}
        <small style={{ fontWeight: 300, fontSize: "0.7em" }}>.{second}</small>
      </Title>
    </Space>
  );
}

export default Countdown;
