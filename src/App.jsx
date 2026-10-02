import { Col, Row, Tooltip, Typography } from "antd";
import AppNote from "./components/AppNote";
import AppTimer from "./components/AppTimer";
import AppTodo from "./components/AppTodo";
import DayPicker from "./components/DayPicker";
import styles from './App.module.css';
import AppFooter from "./components/AppFooter";
import { DayProvider } from "./redux/day";

const { Title, Text } = Typography;

function App() {
  const hourLeftForToday = 24 - new Date().getHours();

  return (
    <DayProvider>
      <div className={styles.container}>
        <Row justify="space-between" align="middle" className={styles.header}>
          <Title level={2} style={{ fontWeight: 300 }} className="no-margin-important">
            Kaizen
          </Title>
          <Tooltip title="Represent times left from 24 hours of today" className={styles.hide_on_mobile}>
            <Text>{hourLeftForToday}h/24h</Text>
          </Tooltip>
        </Row>
        {/* One picker for the whole page: timers, todos and notes all follow it. */}
        <DayPicker />
        {/* Source order is the phone order (timers, todos, notes in one
            column). From lg up, todos + notes move to the left column and
            timers to the right, via the lg order props. */}
        <Row className={styles.appwrapper} gutter={[{ xs: 32, sm: 50 }, 50]} data-testid="sections">
          <Col span={24} lg={{ order: 2, span: 12 }}>
            <AppTimer />
          </Col>
          <Col span={24} lg={{ order: 1, span: 12 }}>
            <AppTodo />
            <div className={styles.section_gap}>
              <AppNote />
            </div>
          </Col>
        </Row>
        <AppFooter />
      </div>
    </DayProvider>
  );
}

export default App;
