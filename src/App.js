import { Col, Row, Typography } from "antd";
import { store } from "./redux/store";
import AddTask from "./components/AddTask";
import TaskItem from "./components/TaskItem";
import { useContext } from "react";

const { Title } = Typography;

function App() {
  const { tasks } = useContext(store);

  const totalHour = () => {
    const total = Math.ceil(
      tasks.reduce((acc, cur) => acc + cur.seconds, 0) / 3600
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
          <AddTask />
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </Col>
      </Row>
    </>
  );
}

export default App;
