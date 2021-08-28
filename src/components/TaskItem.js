import { useContext, useState } from "react";
import {
  DeleteOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Modal } from "antd";
import TaskCountdown from "./TaskCountdown";
import { store } from "../redux/store";

function TaskItem({ task }) {
  const { deleteTask } = useContext(store);
  const [play, setPlay] = useState(false);

  const buttonIcon = () => {
    return play ? <PauseCircleFilled /> : <PlayCircleFilled />;
  };

  const buttonType = () => {
    return play ? "primary" : "default";
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: "delete task?",
      onOk: () => deleteTask(id),
    });
  };

  return (
    <Card className="margin-top-1" size="small">
      <Row justify="space-between" align="middle">
        <Col>{task.title}</Col>
        <Col>
          <Space align="center" size="middle">
            <TaskCountdown
              id={task.id}
              play={play}
              seconds={task.seconds}
              secondsSpent={task.secondsSpent}
            />
            <Space size="small">
              <Button
                type={buttonType()}
                icon={buttonIcon()}
                shape="circle"
                onClick={() => setPlay(!play)}
              />
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(task.id)}
              />
            </Space>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export default TaskItem;
