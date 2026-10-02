import { useState } from "react";
import { Checkbox, Modal, Typography, message } from "antd";
import { DAYS, DAY_LABELS, DAY_NAMES } from "../utilities/day-helper";
import styles from "./CopyToDays.module.css";

// Picks weekdays to copy something to. The item's own day, and days for which
// isDuplicate(day) is true, are disabled: copying there would only add a
// duplicate. Shared by TimerCopy and the todo list.
function CopyToDays({ title, day, isDuplicate, hint, open, onCopy, onClose }) {
  const [days, setDays] = useState([]);

  const close = () => {
    setDays([]);
    onClose();
  };

  const handleOk = () => {
    onCopy(days);
    message.success(`Copied to ${DAYS.filter((d) => days.includes(d)).map((d) => DAY_LABELS[d]).join(", ")}`);
    close();
  };

  const options = DAYS.map((d) => ({
    label: DAY_LABELS[d],
    value: d,
    title: DAY_NAMES[d],
    disabled: d === day || isDuplicate(d),
  }));

  return (
    <Modal
      open={open}
      width={417}
      title={`Copy "${title}" to`}
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
        {hint}
      </Typography.Text>
    </Modal>
  );
}

export default CopyToDays;
