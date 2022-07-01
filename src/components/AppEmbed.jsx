import { useContext, useState } from "react";
import { Space, Input, Form, Modal, Button, List, Row, Typography } from "antd";
import { store } from "../redux/store";
import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { useForm } from "antd/lib/form/Form";

const { Title, Text } = Typography;
const { Item } = Form;

function AppEmbed() {
  const [show, setShow] = useState(false);
  const { embeds, addEmbed, deleteEmbed } = useContext(store);
  const [form] = useForm();

  const handleAdd = (values) => {
    addEmbed(values.link);
    setShow(false);
    form.resetFields();
  };

  const handleDelete = (id) => {
    deleteEmbed(id);
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
              <Space>
                <span>Embed YTs Video</span>
                <Text type="secondary" style={{ fontSize: "0.6em" }}>
                  (Stay away from YT Suggestion Distraction)
                </Text>
              </Space>
            </Title>
            <Button icon={<PlusOutlined />} onClick={() => setShow(true)} />
          </Row>
        }
        dataSource={embeds}
        renderItem={(item) => (
          <List.Item>
            <iframe
              src={"https://youtube.com/embed/" + item.link}
              title={item.id}
              width="100%"
              height={120}
              frameBorder={0}
            ></iframe>
            <Button
              icon={<DeleteOutlined />}
              danger
              type="link"
              onClick={() => handleDelete(item.id)}
            />
          </List.Item>
        )}
      />
      <Modal
        visible={show}
        title="Embed Youtube Video. Place the video id here"
        onOk={() => form.submit()}
        onCancel={() => setShow(false)}
      >
        <Form form={form} onFinish={handleAdd}>
          <Item name="link" required={true}>
            <Input type="url" placeholder="e.g: cr67ukCRPlw" />
          </Item>
        </Form>
      </Modal>
    </>
  );
}

export default AppEmbed;
