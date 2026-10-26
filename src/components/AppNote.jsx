import { CloseOutlined, PlusOutlined } from "@ant-design/icons";
import { Col, Row, Form, Button, Grid, List, Typography, Modal, Input, Radio, Tag } from "antd";
import { useForm } from "antd/lib/form/Form";
import { useContext, useState } from "react";
import { store } from "../redux/store";
import { useDay } from "../redux/day";
import { DAY_NAMES, EVERY_DAY } from "../utilities/day-helper";

const { Title } = Typography;
const { Item } = Form;

const isEveryDay = (note) => note.day === EVERY_DAY;

function AppNote() {
  const { notes, addNote, deleteNote } = useContext(store);
  // The viewed day's reminders, after the ones that show on every day. New
  // ones belong to that day unless "Every day" is picked.
  const { selectedDay } = useDay();
  const [form] = useForm();
  const [show, setShow] = useState(false);
  // Phones: bigger touch targets, and a large (16px) input so iOS doesn't zoom
  // the page when it's focused.
  const isMobile = !!Grid.useBreakpoint().xs;

  const shown = [...notes.filter(isEveryDay), ...notes.filter((note) => note.day === selectedDay)];

  const open = () => {
    form.resetFields();
    setShow(true);
  };

  const handleAdd = (values) => {
    // Blank notes would be invisible rows; just close the dialog.
    if (values.content?.trim()) addNote(values.content, values.when === "every" ? EVERY_DAY : selectedDay);
    form.resetFields();
    setShow(false);
  };

  // An every-day reminder disappears from all days, so ask first.
  const handleDelete = (note) => {
    if (!isEveryDay(note)) {
      deleteNote(note.id);
      return;
    }
    Modal.confirm({
      title: "Delete from every day?",
      content: "This reminder shows on all days. Deleting it removes it everywhere.",
      okText: "Delete",
      okButtonProps: { danger: true },
      onOk: () => deleteNote(note.id),
    });
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
              Reminders
            </Title>
            <Button
              icon={<PlusOutlined />}
              size={isMobile ? "large" : "middle"}
              aria-label="Add reminder"
              onClick={open}
            />
          </Row>
        }
        dataSource={shown}
        renderItem={(item) => (
          <List.Item>
            <Row wrap={false} align="middle" gutter={8} style={{ width: "100%" }}>
              <Col flex="auto" style={{ minWidth: 0, overflowWrap: "anywhere" }}>
                {item.content}
              </Col>
              {isEveryDay(item) && (
                <Col flex="none">
                  <Tag color="blue" style={{ marginInlineEnd: 0 }}>
                    Every day
                  </Tag>
                </Col>
              )}
              <Col flex="none">
                <Button
                  size={isMobile ? "middle" : "small"}
                  type="link"
                  danger
                  icon={<CloseOutlined />}
                  aria-label="Delete reminder"
                  title="Delete reminder"
                  onClick={() => handleDelete(item)}
                />
              </Col>
            </Row>
          </List.Item>
        )}
      />
      <Modal
        open={show}
        title="New reminder"
        onOk={() => form.submit()}
        onCancel={() => setShow(false)}
      >
        <Form
          form={form}
          name="reminder-add"
          size={isMobile ? "large" : undefined}
          initialValues={{ when: "day" }}
          onFinish={handleAdd}
        >
          <Item name="content" required={true}>
            <Input placeholder="eg. do something at 3am" aria-label="Reminder" />
          </Item>
          <Item name="when" style={{ marginBottom: 0 }}>
            <Radio.Group
              optionType="button"
              buttonStyle="solid"
              block
              aria-label="Show on"
              options={[
                { value: "day", label: `Only ${DAY_NAMES[selectedDay]}` },
                { value: "every", label: "Every day" },
              ]}
            />
          </Item>
        </Form>
      </Modal>
    </>
  );
}

export default AppNote;
