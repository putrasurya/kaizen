import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Col, Row, Form, Button, Grid, List, Typography, Modal, Input } from "antd";
import { useForm } from "antd/lib/form/Form";
import { useContext, useState } from "react";
import { store } from "../redux/store";

const { Title } = Typography;
const { Item } = Form;

function AppNote() {
  const { notes, addNote, deleteNote } = useContext(store);
  const [form] = useForm();
  const [show, setShow] = useState(false);
  // Phones: bigger touch targets, and a large (16px) input so iOS doesn't zoom
  // the page when it's focused.
  const isMobile = !!Grid.useBreakpoint().xs;

  const handleAdd = (values) => {
    addNote(values.content);
    form.resetFields();
    setShow(false);
  };

  const handleDelete = (id) => {
    deleteNote(id);
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
              Take Note
            </Title>
            <Button
              icon={<PlusOutlined />}
              size={isMobile ? "large" : "middle"}
              onClick={() => setShow(true)}
            />
          </Row>
        }
        dataSource={notes}
        renderItem={(item) => (
          <List.Item>
            <Row wrap={false} style={{ width: "100%" }}>
              <Col flex="auto" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                {item.content}
              </Col>
              <Col flex="none">
                <Button
                  size={isMobile ? "middle" : "small"}
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
        open={show}
        title="What to remind?"
        onOk={() => form.submit()}
        onCancel={() => setShow(false)}
      >
        <Form form={form} size={isMobile ? "large" : undefined} onFinish={handleAdd}>
          <Item name="content" required={true}>
            <Input placeholder="eg. do something at 3am" />
          </Item>
        </Form>
      </Modal>
    </>
  );
}

export default AppNote;
