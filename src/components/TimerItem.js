import { useContext, useState } from "react";
import {
  DeleteOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Modal } from "antd";
import TimerCountdown from "./TimerCountdown";
import { store } from "../redux/store";

function TimerItem({ timer }) {
  const { deleteTimer, updateSecondsSpent } = useContext(store);
  const [play, setPlay] = useState(false);

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
    <Card className="margin-top-1" size="small">
      <Row justify="space-between" align="middle">
        <Col>{timer.title}</Col>
        <Col>
          <Space align="center" size="middle">
            <TimerCountdown
              key={timer.id}
              id={timer.id}
              play={play}
              seconds={timer.seconds}
              secondsSpent={timer.secondsSpent}
              setPlay={setPlay}
            />
            <Space size="small">
              <Button
                type={buttonType()}
                icon={buttonIcon()}
                shape="circle"
                onClick={() => setPlay(!play)}
              />
              <div>
                <Button
                  type="link"
                  disabled={play}
                  icon={<UndoOutlined />}
                  onClick={() => handleReset(timer)}
                />
                <Button
                  type="link"
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
