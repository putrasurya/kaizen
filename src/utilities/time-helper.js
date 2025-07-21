export function extractToHourMinuteAndSecond(secs) {
    const hour = Math.floor(secs / 3600);
    const minute = Math.floor((secs % 3600) / 60);
    const second = secs % 60;
    return [hour, minute, second];
}

export function extractToHourMinuteAndSecondWithPadZero(secs) {
  const [hour, minute, second] = extractToHourMinuteAndSecond(secs);
  return [hour, String(minute).padStart(2, "0"), String(second).padStart(2, "0")];
}

export function millisToSeconds(millis) {
  return Math.floor(millis/1000);
}

export function secondsToMillis(seconds) {
  return seconds*1000;
}