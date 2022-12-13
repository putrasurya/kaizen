/* eslint-disable react-hooks/exhaustive-deps */
import { Typography, Space, Tooltip } from "antd";
import { useEffect, useState, useRef, useContext } from "react";
import { store } from "../redux/store";

const { Title } = Typography;

function Buzz() {
  const audio = document.getElementById('buzzbuzz');
  audio.hidden = true;
  audio.volume = 1;
  audio.play()
}

export default function Countdown({ id, play, seconds, secondsSpent, setPlay, className }) {
  const { updateSecondsSpent } = useContext(store);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState("00");
  const [second, setSecond] = useState("00");
  const [tooltipDisplay, setTooltipDisplay] = useState("0.00/0.00");
  const spent = useRef(secondsToMillis(secondsSpent || 0));
  const timeStart = useRef(null);

  useEffect(() => {
    playPropChanged();
    tiktok();
  }, [play]);

  useEffect(() => {
    secondsSpentPropChanged();
  }, [secondsSpent])

  function playPropChanged() {
    if (false === play) {
      timeStart.current = null;
      updateSecondsSpent(id, millisToSeconds(spent.current));
    } else {
      timeStart.current = new Date();
    }
  }

  function secondsSpentPropChanged() {
    if (secondsSpent === 0 && false === play) {
      timeStart.current = new Date();
      spent.current = 0;
      tiktok();
    }
  }

  function updateTooltipDisplay() {
    const [originHour, originMinute] = extractToHourMinuteAndSecondWithPadZero(seconds);
    setTooltipDisplay(`${hour}.${minute} / ${originHour}.${originMinute}`)
  }

  function tiktok() {
    updateTooltipDisplay();

    if (spent.current >= secondsToMillis(seconds)) {
      if (spent.current > secondsToMillis(seconds)) {
        setHour((_) => 0);
        setMinute((_) => "00");
        setSecond((_) => "00");
        updateSecondsSpent(id, seconds);
        if (play === true) {
          Buzz();
        }
        setPlay(false);
      }
      return;
    }

    const secondsLeft = seconds - millisToSeconds(spent.current);
    const [hour, minute, second] = extractToHourMinuteAndSecondWithPadZero(secondsLeft);

    setHour((_) => hour);
    setMinute((_) => minute);
    setSecond((_) => second);

    // stop when it's not playing
    if (!play || null === timeStart.current) return;

    const realtimeGap = new Date().getTime() - timeStart.current.getTime();
    spent.current = secondsSpent * 1000 + realtimeGap;

    // update store when it's rounded to a minute
    if (millisToSeconds(spent.current) % 60 === 0) {
      updateSecondsSpent(id, millisToSeconds(spent.current));
    }

    setTimeout(() => tiktok(), 1000);
  }

  return (
    <Space>
      <Tooltip title={tooltipDisplay}>
        <Title level={3} className={className}>
          {hour}.{minute}
          <small style={{ fontWeight: 300, fontSize: "0.7em" }}>.{second}</small>
        </Title>
      </Tooltip>
    </Space>
  );
}

function extractToHourMinuteAndSecond(secs) {
    const hour = Math.floor(secs / 3600);
    const minute = Math.floor((secs % 3600) / 60);
    const second = secs % 60;
    return [hour, minute, second];
}

function extractToHourMinuteAndSecondWithPadZero(secs) {
  const [hour, minute, second] = extractToHourMinuteAndSecond(secs);
  return [hour, String(minute).padStart(2, "0"), String(second).padStart(2, "0")];
}

function millisToSeconds(millis) {
  return Math.floor(millis/1000);
}

function secondsToMillis(seconds) {
  return seconds*1000;
}