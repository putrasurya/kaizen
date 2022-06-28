import { Col, Row } from "antd";
import AppNote from "./components/AppNote";
import AppTimer from "./components/AppTimer";
import styles from './App.module.css';

function App() {
  return (
    <div className={styles.container}>
      <Row className="padding-top-2" gutter={[50, 50]}>
        <Col span={24} xs={{ order: 2 }} lg={{ order: 1, span: 12 }} xl={12}>
          <AppNote />
        </Col>
        <Col span={24} xs={{ order: 1 }} lg={{ order: 1, span: 12 }} xl={12}>
          <AppTimer />
        </Col>
      </Row>
    </div>
  );
}

export default App;
