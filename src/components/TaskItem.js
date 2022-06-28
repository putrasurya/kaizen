import { useContext, useState } from "react";
import {
  DeleteOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
  UndoOutlined,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Modal } from "antd";
import TaskCountdown from "./TaskCountdown";
import { store } from "../redux/store";

function TaskItem({ task }) {
  const { deleteTask, updateSecondsSpent } = useContext(store);
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
      onOk: () => deleteTask(id),
    });
  };

  const handleReset = (task) => {
    Modal.confirm({
      title: "reset timer?",
      onOk: () => updateSecondsSpent(task.id, 0),
    });
  }

  return (
    <Card className="margin-top-1" size="small">
      <Row justify="space-between" align="middle">
        <Col>{task.title}</Col>
        <Col>
          <Space align="center" size="middle">
            <TaskCountdown
              key={task.id}
              id={task.id}
              play={play}
              seconds={task.seconds}
              secondsSpent={task.secondsSpent}
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
                  onClick={() => handleReset(task)}
                />
                <Button
                  type="link"
                  danger
                  disabled={play}
                  icon={<DeleteOutlined />}
                  onClick={() => handleDelete(task.id)}
                />
              </div>
            </Space>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export default TaskItem;
