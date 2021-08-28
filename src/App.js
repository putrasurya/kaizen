import { Col, Row } from "antd";
import AppEmbed from "./components/AppEmbed";
import AppReminder from "./components/AppReminder";
import AppTimer from "./components/AppTimer";

function App() {
  return (
    <div className="padding-left-3 padding-right-3">
      <Row className="padding-top-2" gutter={50}>
        <Col span={8}>
          <AppReminder />
        </Col>
        <Col span={8}>
          <AppTimer />
        </Col>
        <Col span={8}>
          <AppEmbed />
        </Col>
      </Row>
    </div>
  );
}

export default App;
