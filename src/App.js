import { Col, Row, Typography } from "antd";
import useTask from "./hooks/useTask";
import AddTask from "./components/AddTask";
import TaskList from "./components/TaskList";

const { Title } = Typography;

function App() {
  const task = useTask();

  const hourSpent = () => {
    return Math.floor(
      task.tasks.reduce((acc, cur) => acc + cur.minutesSpent, 0) / 60
    );
  };

  const totalHour = () => {
    return Math.ceil(
      task.tasks.reduce((acc, cur) => acc + cur.minutes, 0) / 60
    );
  };

  return (
    <>
      <Row className="margin-top-2">
        <Col offset={8} span={8}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ fontWeight: 300 }}>
                My Timer
              </Title>
            </Col>
            <Col>
              <Title level={4} style={{ fontWeight: 400 }}>
                Time spent: {hourSpent()}/{totalHour()} hours
              </Title>
            </Col>
          </Row>
          <AddTask taskHook={task} />
          <TaskList taskHook={task} />
        </Col>
      </Row>
    </>
  );
}

export default App;
