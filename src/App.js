import { Col, Row, Typography, Button, Card, Space } from 'antd';

const { Text, Title } = Typography;

function App() {
  return (
    <>
      <Row className="margin-top-2">
        <Col offset={8} span={8}>
          <Row justify='space-between' align='middle'>
            <Col><Title level={2} style={{fontWeight: 300}}>My Timer</Title></Col>
            <Col><Title level={4} style={{fontWeight: 400}}>Time spent: 12/20 hours</Title></Col>
          </Row>
          <Button size="large" block={true} type='dashed' className='margin-bottom-1'>+ Add Timer Task</Button>
          <Card className='margin-top-1' size='small'>
            <Row justify='space-between' align='middle'>
              <Col>Ngerjain pr anak ku</Col>
              <Col>
                <Space align='center' size='middle'>
                  <Title level={3} className='no-margin-important'>2:00</Title>
                  <Button size='small'>Play</Button>
                </Space>
              </Col>
            </Row>
          </Card>
          <Card className='margin-top-1' size='small'>
            <Row justify='space-between' align='middle'>
              <Col>Ngerjain pr anak ku</Col>
              <Col>
                <Space align='center' size='middle'>
                  <Title level={3} className='no-margin-important'>2:00</Title>
                  <Button size='small'>Play</Button>
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </>
  );
}

export default App;
