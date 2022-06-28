import { Col, Divider, Row, Space, Tooltip, Typography } from "antd";
import { useContext } from "react";
import TimerAdd from "./TimerAdd";
import TimerItem from "./TimerItem";
import { store } from "../redux/store";

const { Title, Text } = Typography;

function AppTimer() {
  const { timers } = useContext(store);

  const totalHour = () => {
    const secsInitial = timers.reduce((acc, cur) => acc + cur.seconds, 0);
    const secsSpent = timers.reduce((acc, cur) => acc + cur.secondsSpent, 0);
    const secs = secsInitial - secsSpent;
    const hours = Math.floor(secs / 3600);
    const minutes = Math.floor((secs % 3600) / 60);
    return `${hours}.${minutes} Times left`;
  };

  const hourLeftForToday = () => {
    return 24 - new Date().getHours();
  };

  return (
    <>
      <Row justify="space-between" align="middle">
        <Col>
          <Title level={2} style={{ fontWeight: 300 }}>
            MultiTimer
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
            <Tooltip title="Represent times left from 24 hours of today">
              <Text>{hourLeftForToday()}h/24h</Text>
            </Tooltip>
          </Space>
        </Col>
      </Row>
      <TimerAdd />
      {timers.map((timer) => (
        <TimerItem key={timer.id} timer={timer} />
      ))}
    </>
  );
}

export default AppTimer;
