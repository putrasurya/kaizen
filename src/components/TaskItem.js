import { useContext, useState } from "react";
import {
  DeleteOutlined,
  PauseCircleFilled,
  PlayCircleFilled,
} from "@ant-design/icons";
import { Button, Card, Col, Row, Space, Modal } from "antd";
import Countdown from "./Countdown";
import { store } from "../redux/store";

function TaskItem({ task }) {
  const { deleteTask } = useContext(store);
  const [play, setPlay] = useState(false);

  const buttonIcon = () => {
    return play ? <PauseCircleFilled /> : <PlayCircleFilled />;
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
            <Countdown
              id={task.id}
              play={play}
              seconds={task.seconds}
              secondsSpent={task.secondsSpent}
            />
            <Button icon={buttonIcon()} onClick={() => setPlay(!play)} />
            <Button
              type="link"
              color="danger"
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(task.id)}
            />
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export default TaskItem;
