import { useContext } from "react";
import { store, hasIdenticalTimer } from "../redux/store";
import CopyToDays from "./CopyToDays";

// Copies one timer to other weekdays.
function TimerCopy({ timer, open, onClose }) {
  const { timers, copyTimer } = useContext(store);

  return (
    <CopyToDays
      title={timer.title}
      day={timer.day}
      isDuplicate={(day) => hasIdenticalTimer(timers, timer, day)}
      hint="Copies start fresh: not running, no progress, no reps. Days that already have this timer are skipped."
      open={open}
      onCopy={(days) => copyTimer(timer.id, days)}
      onClose={onClose}
    />
  );
}

export default TimerCopy;
