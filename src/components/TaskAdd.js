import { Button, Modal, Form, Input, Radio } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useContext, useState } from "react";
import { useForm } from "antd/lib/form/Form";
import { store } from "../redux/store";

const { Item } = Form;

function AddTask() {
  const { addTask } = useContext(store);
  const [show, setShow] = useState(false);
  const [form] = useForm();

  const timeOptions = [
    { label: "0H", value: 0 },
    { label: "1H", value: 60 * 60 * 1 },
    { label: "2H", value: 60 * 60 * 2 },
    { label: "3H", value: 60 * 60 * 3 },
    { label: "4H", value: 60 * 60 * 4 },
    { label: "5H", value: 60 * 60 * 5 },
    { label: "6H", value: 60 * 60 * 6 },
  ];

  const timeAdditionalOptions = [
    { label: "0 mins", value: 0 },
    { label: "15 mins", value: 60 * 15 },
    { label: "30 mins", value: 60 * 30 },
    { label: "45 mins", value: 60 * 45 },
  ];

  const addingTask = (values) => {
    addTask(values.title, values.seconds + values.secondsAdditional);
    setShow(false);
    form.resetFields();
  };

  return (
    <>
      <Button
        size="large"
        block={true}
        type="dashed"
        className="margin-bottom-1"
        icon={<PlusOutlined />}
        onClick={() => setShow(true)}
      >
        Add Timer Task
      </Button>
      <Modal
        visible={show}
        width={417}
        title="Add Timer Task"
        onCancel={() => {
          setShow(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          size="large"
          onFinish={addingTask}
          initialValues={{ seconds: 60 * 60, secondsAdditional: 0 }}
        >
          <Item name="title" required={true}>
            <Input placeholder="eg. Crafting Hydroponic Frame" />
          </Item>
          <Item name="seconds" required={true}>
            <Radio.Group
              options={timeOptions}
              optionType="button"
              buttonStyle="solid"
            />
          </Item>
          <Item name="secondsAdditional" required={true}>
            <Radio.Group
              options={timeAdditionalOptions}
              optionType="button"
              buttonStyle="solid"
            />
          </Item>
        </Form>
      </Modal>
    </>
  );
}

export default AddTask;
