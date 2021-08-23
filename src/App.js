import { Col, Row, Typography } from "antd";
import useTask from "./hooks/useTask";
import AddTask from "./components/AddTask";
import TaskItem from "./components/TaskItem";

const { Title } = Typography;

function App() {
  const task = useTask();

  const totalHour = () => {
    const total = Math.ceil(
      task.tasks.reduce((acc, cur) => acc + cur.seconds, 0) / 3600
    );
    const suffix = total > 1 ? "hours" : "hour";
    return `${total} ${suffix} to focus`;
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
                {totalHour()}
              </Title>
            </Col>
          </Row>
          <AddTask taskHook={task} />
          {task.tasks.map((_task) => (
            <TaskItem task={_task} />
          ))}
        </Col>
      </Row>
    </>
  );
}

export default App;
