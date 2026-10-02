import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Col, Row, Form, Button, Grid, List, Typography, Modal, Input } from "antd";
import { useForm } from "antd/lib/form/Form";
import { useContext, useState } from "react";
import { store } from "../redux/store";
import { useDay } from "../redux/day";
import { DAY_NAMES } from "../utilities/day-helper";

const { Title } = Typography;
const { Item } = Form;

function AppNote() {
  const { notes, addNote, deleteNote } = useContext(store);
  // Only the viewed day's notes; new ones belong to that day.
  const { selectedDay } = useDay();
  const [form] = useForm();
  const [show, setShow] = useState(false);
  // Phones: bigger touch targets, and a large (16px) input so iOS doesn't zoom
  // the page when it's focused.
  const isMobile = !!Grid.useBreakpoint().xs;

  const handleAdd = (values) => {
    // Blank notes would be invisible rows; just close the dialog.
    if (values.content?.trim()) addNote(values.content, selectedDay);
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
        dataSource={notes.filter((note) => note.day === selectedDay)}
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
        title={`What to remind on ${DAY_NAMES[selectedDay]}?`}
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
