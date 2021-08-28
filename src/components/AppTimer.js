import { Col, Divider, Row, Space, Typography } from "antd";
import { useContext } from "react";
import TaskAdd from "./TaskAdd";
import TaskItem from "./TaskItem";
import { store } from "../redux/store";

const { Title, Text } = Typography;

function AppTimer() {
  const { tasks } = useContext(store);

  const totalHour = () => {
    const total = Number(
      tasks.reduce((acc, cur) => acc + cur.seconds, 0) / 3600
    ).toFixed(2);
    const suffix = total > 1 ? "hours" : "hour";
    return `${total} ${suffix} to focus`;
  };

  const hourLeftForToday = () => {
    return 24 - new Date().getHours();
  };

  return (
    <>
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
      <TaskAdd />
      {tasks.map((task) => (
        <TaskItem key={task.id} task={task} />
      ))}
    </>
  );
}

export default AppTimer;
