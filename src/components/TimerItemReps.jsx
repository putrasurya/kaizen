import { useContext, useState } from "react";
import { Typography } from "antd";
import { extractToHourMinuteAndSecond } from "../utilities/time-helper";
import { store } from "../redux/store";
import styles from "./TimerItemReps.module.css";

function TimerItemReps({ timer }) {
    const { resetReps } = useContext(store);

    const computeTime = () => {
        const [hour, minute, second] = extractToHourMinuteAndSecond(timer.initial * timer.reps);
        return `${hour}:${minute}:${second}`;
    }

    return (
        <Typography.Text type="secondary" className={styles.item_reps}>
            {timer.reps} Reps | {computeTime()} <a onClick={() => resetReps(timer.id)} className={styles.reset_reps}>reset</a>
        </Typography.Text>
    );
}

export default TimerItemReps;