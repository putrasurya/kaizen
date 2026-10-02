import { useContext, useState } from "react";
import {
  DeleteOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Grid, Row, Space, Modal, Typography } from "antd";
import TimerCountdown from "./TimerCountdown";
import { store } from "../redux/store";
import styles from "./TimerItem.module.css";
import TimerItemReps from "./TimerItemReps";

function TimerItem({ timer }) {
  const { deleteTimer, updateSecondsSpent } = useContext(store);
  const [play, setPlay] = useState(false);
  // Phones: title on its own line, countdown + controls spread across the next
  // one, with larger buttons for touch.
  const isMobile = !!Grid.useBreakpoint().xs;
  const buttonSize = isMobile ? "large" : "middle";

  const buttonIcon = () => {
    return play ? <PauseCircleFilled /> : <PlayCircleFilled />;
  };

  const buttonType = () => {
    return play ? "primary" : "default";
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: "delete timer?",
      onOk: () => deleteTimer(id),
    });
  };

  const handleReset = (timer) => {
    Modal.confirm({
      title: "reset timer?",
      onOk: () => updateSecondsSpent(timer.id, 0),
    });
  }

  return (
    <Card className={play?styles.timer_play:styles.timer_pause } size="small">
      <Row justify="space-between" align="middle" wrap={isMobile}>
        <Col flex={isMobile ? "1 1 100%" : "auto"}>
          <Typography.Text ellipsis style={{paddingRight: 15, display: "block"}}>{timer.title}</Typography.Text>
          <TimerItemReps timer={timer} />
        </Col>
        <Col flex={isMobile ? "1 1 100%" : "none"}>
          <Space
            align="center"
            size="middle"
            className={isMobile ? styles.controls_mobile : undefined}
          >
            <TimerCountdown
              key={timer.id}
              id={timer.id}
              play={play}
              seconds={timer.seconds}
              secondsSpent={timer.secondsSpent}
              setPlay={setPlay}
              className={play?styles.countdown_play:styles.countdown_pause}
            />
            <Space size="small">
              <Button
                type={buttonType()}
                icon={buttonIcon()}
                shape="circle"
                size={buttonSize}
                disabled={timer.seconds === timer.secondsSpent}
                onClick={() => setPlay(!play)}
              />
              <div>
                <Button
                  type="link"
                  size={buttonSize}
                  disabled={play}
                  icon={<UndoOutlined />}
                  onClick={() => handleReset(timer)}
                />
                <Button
                  type="link"
                  size={buttonSize}
                  danger
                  disabled={play}
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(timer.id)}
                />
              </div>
            </Space>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export default TimerItem;
