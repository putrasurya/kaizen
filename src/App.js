import { Col, Row, Typography } from "antd";
import useTask from "./hooks/useTask";
import AddTask from "./components/AddTask";
import TaskList from "./components/TaskList";

const { Title } = Typography;

function App() {
  const task = useTask();

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
                Time spent: 12/20 hours
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
