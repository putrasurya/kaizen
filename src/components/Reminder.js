import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Col, Row, Form, Button, List, Typography, Modal, Input } from "antd";
import { useForm } from "antd/lib/form/Form";
import { useContext, useState } from "react";
import { store } from "../redux/store";

const { Title } = Typography;
const { Item } = Form;

function Reminder() {
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
          <Title
            level={3}
            style={{ fontWeight: 300 }}
            className="no-margin-important"
          >
            Reminder
          </Title>
        }
        footer={
          <Button icon={<PlusOutlined />} onClick={() => setShow(true)}>
            Add Reminder
          </Button>
        }
        dataSource={reminders}
        renderItem={(item) => (
          <List.Item>
            <Row justify="space-between" style={{ width: "100%" }}>
              <Col>{item.content}</Col>
              <Button
                size="small"
                type="link"
                icon={<CloseOutlined />}
                onClick={() => handleDelete(item.id)}
              />
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

export default Reminder;
