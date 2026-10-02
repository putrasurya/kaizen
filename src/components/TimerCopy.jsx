import { useContext, useState } from "react";
import { Checkbox, Modal, Typography, message } from "antd";
import { store, hasIdenticalTimer } from "../redux/store";
import { DAYS, DAY_LABELS, DAY_NAMES } from "../utilities/day-helper";
import styles from "./TimerCopy.module.css";

// Copies one timer to other weekdays. Its own day, and days that already have
// an identical timer, are disabled: copying there would only add a duplicate.
function TimerCopy({ timer, open, onClose }) {
  const { timers, copyTimer } = useContext(store);
  const [days, setDays] = useState([]);

  const close = () => {
    setDays([]);
    onClose();
  };

  const handleOk = () => {
    copyTimer(timer.id, days);
    message.success(`Copied to ${DAYS.filter((day) => days.includes(day)).map((day) => DAY_LABELS[day]).join(", ")}`);
    close();
  };

  const options = DAYS.map((day) => ({
    label: DAY_LABELS[day],
    value: day,
    title: DAY_NAMES[day],
    disabled: day === timer.day || hasIdenticalTimer(timers, timer, day),
  }));

  return (
    <Modal
      open={open}
      width={417}
      title={`Copy "${timer.title}" to`}
      okText="Copy"
      okButtonProps={{ disabled: days.length === 0 }}
      onOk={handleOk}
      onCancel={close}
    >
      <Checkbox.Group
        className={styles.days}
        options={options}
        value={days}
        onChange={setDays}
      />
      <Typography.Text type="secondary" className={styles.hint}>
        Copies start fresh: not running, no progress, no reps. Days that already
        have this timer are skipped.
      </Typography.Text>
    </Modal>
  );
}

export default TimerCopy;
