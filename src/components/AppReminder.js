import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Col, Row, Form, Button, List, Typography, Modal, Input } from "antd";
import { useForm } from "antd/lib/form/Form";
import { useContext, useState } from "react";
import { store } from "../redux/store";

const { Title } = Typography;
const { Item } = Form;

function AppReminder() {
  const { reminders, addReminder, deleteReminder } = useContext(store);
  const [form] = useForm();
  const [show, setShow] = useState(false);

  const handleAdd = (values) => {
    addReminder(values.content);
    form.resetFields();
    setShow(false);
  };

  const handleDelete = (id) => {
    deleteReminder(id);
  };

  return (
    <>
      <List
        header={
          <Row justify="space-between">
            <Title
              level={3}
              style={{ fontWeight: 300 }}
              className="no-margin-important"
            >
              Reminder
            </Title>
            <Button icon={<PlusOutlined />} onClick={() => setShow(true)} />
          </Row>
        }
        dataSource={reminders}
        renderItem={(item) => (
          <List.Item>
            <Row wrap={false} style={{ width: "100%" }}>
              <Col flex="auto">{item.content}</Col>
              <Col flex="none">
                <Button
                  size="small"
                  type="link"
                  danger
                  icon={<CloseOutlined />}
                  onClick={() => handleDelete(item.id)}
                />
              </Col>
            </Row>
          </List.Item>
        )}
      />
      <Modal
        visible={show}
        title="What to remind?"
        onOk={() => form.submit()}
        onCancel={() => setShow(false)}
      >
        <Form form={form} onFinish={handleAdd}>
          <Item name="content" required={true}>
            <Input placeholder="eg. do something at 3am" />
          </Item>
        </Form>
      </Modal>
    </>
  );
}

export default AppReminder;
