import { Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useContext, useState } from "react";
import { store } from "../redux/store";
import { DAY_NAMES } from "../utilities/day-helper";
import TimerForm from "./TimerForm";
import styles from "./TimerAdd.module.css";

// `day` is the weekday being viewed; new timers belong to it.
function AddTimer({ day }) {
  const { addTimer } = useContext(store);
  const [show, setShow] = useState(false);

  return (
    <>
      <Button
        size="large"
        block={true}
        type="dashed"
        className={styles.add_timer_button}
        icon={<PlusOutlined />}
        onClick={() => setShow(true)}
      >
        Add Timer
      </Button>
      <TimerForm
        open={show}
        title={day ? `Add Timer for ${DAY_NAMES[day]}` : "Add Timer"}
        okText="Add"
        onSubmit={({ title, seconds, pomodoro }) => addTimer(title, seconds, 0, false, day, pomodoro)}
        onClose={() => setShow(false)}
      />
    </>
  );
}

export default AddTimer;
