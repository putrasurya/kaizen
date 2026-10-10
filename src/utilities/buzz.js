// The alarm sound. The <audio> element used to be appended inside #root at
// startup, but React clears #root when it first renders, so it vanished and
// every finished timer crashed on `audio.hidden`. Now it lives on <body>, is
// created on demand if missing, and a blocked play() (browsers can refuse
// sound without a recent user gesture) never breaks the timer.
const ID = "buzzbuzz";

export function getAlarm() {
  let audio = document.getElementById(ID);
  if (!audio) {
    audio = document.createElement("audio");
    audio.id = ID;
    audio.src = `${import.meta.env.VITE_BUZZ_WAV ?? ""}`;
    audio.preload = "auto";
    audio.hidden = true;
    document.body.append(audio);
  }
  return audio;
}

export function buzz() {
  try {
    const audio = getAlarm();
    audio.hidden = true;
    audio.volume = 1;
    audio.currentTime = 0;
    const playing = audio.play();
    if (playing?.catch) playing.catch(() => {});
  } catch {
    // No sound is better than a stuck timer.
  }
}

// Phones only allow sound that a tap started. Playing the alarm silently once
// from the play button's tap lets the real buzz play later, even with no tap.
let unlocked = false;
export function unlockAlarm() {
  if (unlocked) return;
  try {
    const audio = getAlarm();
    audio.muted = true;
    const playing = audio.play();
    const done = () => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
    };
    if (playing?.then) {
      playing.then(() => {
        unlocked = true;
        done();
      }, done);
    } else done();
  } catch {
    // ignore
  }
}
