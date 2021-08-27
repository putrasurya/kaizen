import { Col, Row, Typography, Button, Space, Divider } from "antd";
import { store } from "./redux/store";
import AddTask from "./components/AddTask";
import TaskItem from "./components/TaskItem";
import { useContext } from "react";
import Reminder from "./components/Reminder";

const { Title, Text } = Typography;

function App() {
  const { tasks } = useContext(store);

  const totalHour = () => {
    const total = Math.ceil(
      tasks.reduce((acc, cur) => acc + cur.seconds, 0) / 3600
    );
    const suffix = total > 1 ? "hours" : "hour";
    return `${total} ${suffix} to focus`;
  };

  const hourLeftForToday = () => {
    return 24 - new Date().getHours();
  };

  return (
    <div className="padding-left-3 padding-right-3">
      <Row className="padding-top-2" gutter={50}>
        <Col span={8}>
          <Reminder />
        </Col>
        <Col span={8}>
          <Row justify="space-between" align="middle">
            <Col>
              <Title level={2} style={{ fontWeight: 300 }}>
                My Timer
              </Title>
            </Col>
            <Col>
              <Space align="end">
                <Title
                  level={4}
                  style={{ fontWeight: 400 }}
                  className="no-margin-important"
                >
                  {totalHour()}
                </Title>
                <Divider type="vertical" />
                <Text>{hourLeftForToday()}h / 24h today</Text>
              </Space>
            </Col>
          </Row>
          <AddTask />
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </Col>
      </Row>
    </div>
  );
}

export default App;
