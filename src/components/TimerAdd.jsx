import { Button, Modal, Form, Input } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useContext, useState } from "react";
import { useForm } from "antd/lib/form/Form";
import { store } from "../redux/store";
import { DAY_NAMES } from "../utilities/day-helper";
import TimerDurationPicker from "./TimerDurationPicker";
import styles from './TimerAdd.module.css';

const { Item } = Form;

// `day` is the weekday being viewed; new timers belong to it.
function AddTimer({ day }) {
  const { addTimer } = useContext(store);
  const [show, setShow] = useState(false);
  const [form] = useForm();

  const addingTimer = (values) => {
    addTimer(values.title, values.seconds, 0, false, day);
    setShow(false);
    form.resetFields();
  };

  return (
    <>
      <Button
        size="large"
        block={true}
        type="dashed"
        className={styles.add_timer_button}
        icon={<PlusOutlined />}
        onClick={() => setShow(true)}
      >
        Add Timer
      </Button>
      <Modal
        open={show}
        width={417}
        title={day ? `Add Timer for ${DAY_NAMES[day]}` : "Add Timer"}
        onCancel={() => {
          setShow(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          size="large"
          onFinish={addingTimer}
          initialValues={{ seconds: 60 * 60 }}
        >
          <Item name="title" required={true}>
            <Input placeholder="eg. Focus on Works" />
          </Item>
          <Item
            name="seconds"
            className={styles.duration}
            rules={[
              {
                validator: (_, seconds) =>
                  seconds > 0 ? Promise.resolve() : Promise.reject(new Error("Choose a duration longer than 0 minutes")),
              },
            ]}
          >
            <TimerDurationPicker />
          </Item>
        </Form>
      </Modal>
    </>
  );
}

export default AddTimer;
