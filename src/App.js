import { Col, Row } from "antd";
import AppNote from "./components/AppNote";
import AppTimer from "./components/AppTimer";

function App() {
  return (
    <div className="padding-left-3 padding-right-3">
      <Row className="padding-top-2" gutter={[50, 50]}>
        <Col span={24} xs={{ order: 2 }} lg={{ order: 1, span: 12 }} xl={8}>
          <AppNote />
        </Col>
        <Col span={24} xs={{ order: 1 }} lg={{ order: 1, span: 12 }} xl={8}>
          <AppTimer />
        </Col>
      </Row>
    </div>
  );
}

export default App;
