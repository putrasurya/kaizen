import { useState } from "react";
import { PauseCircleFilled, PlayCircleFilled } from "@ant-design/icons";
import { Button, Card, Col, Row, Space } from "antd";
import Countdown from "./Countdown";

function TaskItem({ task }) {
  const [play, setPlay] = useState(false);

  const buttonIcon = () => {
    return play ? <PauseCircleFilled /> : <PlayCircleFilled />;
  };

  return (
    <Card className="margin-top-1" size="small">
      <Row justify="space-between" align="middle">
        <Col>{task.title}</Col>
        <Col>
          <Space align="center" size="middle">
            <Countdown play={play} seconds={task.seconds} />
            <Button icon={buttonIcon()} onClick={() => setPlay(!play)} />
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export default TaskItem;
