import { PauseCircleFilled, PlayCircleFilled } from "@ant-design/icons";
import { Button, Card, Col, Row, Space } from "antd";
import Countdown from "./Countdown";

function TaskList({ taskHook }) {
  const buttonIcon = (task) => {
    return task.play ? <PauseCircleFilled /> : <PlayCircleFilled />;
  };

  const toggleState = (task) => {
    if (task.play) {
      taskHook.pauseTask(task.id);
      return;
    }
    taskHook.playTask(task.id);
  };

  const rendering = () => {
    return taskHook.tasks.map((task) => {
      return (
        <Card className="margin-top-1" size="small">
          <Row justify="space-between" align="middle">
            <Col>{task.title}</Col>
            <Col>
              <Space align="center" size="middle">
                <Countdown taskHook={taskHook} task={task} />
                <Button
                  icon={buttonIcon(task)}
                  onClick={() => toggleState(task)}
                />
              </Space>
            </Col>
          </Row>
        </Card>
      );
    });
  };

  return <>{rendering()}</>;
}

export default TaskList;
