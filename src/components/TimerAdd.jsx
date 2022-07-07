import { Button, Modal, Form, Input, Radio, Divider, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { useContext, useState } from "react";
import { useForm } from "antd/lib/form/Form";
import { store } from "../redux/store";
import styles from './TimerAdd.module.css';

const { Item } = Form;

function AddTimer() {
  const { addTimer } = useContext(store);
  const [theHour, setTheHour] = useState(1);
  const [theMinute, setTheMinute] = useState(0);
  const [show, setShow] = useState(false);
  const [form] = useForm();

  const hourOptions = [
    { label: "0H", value: 0 },
    { label: "1H", value: 60 * 60 * 1 },
    { label: "2H", value: 60 * 60 * 2 },
    { label: "3H", value: 60 * 60 * 3 },
    { label: "4H", value: 60 * 60 * 4 },
    { label: "5H", value: 60 * 60 * 5 },
    { label: "6H", value: 60 * 60 * 6 },
  ];

  const minutes09Options = [
    { label: "0m", value: 0 },
    { label: "1m", value: 60 * 1 },
    { label: "2m", value: 60 * 2 },
    { label: "3m", value: 60 * 3 },
    { label: "4m", value: 60 * 4 },
    { label: "5m", value: 60 * 5 },
    { label: "6m", value: 60 * 6 },
    { label: "7m", value: 60 * 7 },
    { label: "8m", value: 60 * 8 },
    { label: "9m", value: 60 * 9 },
  ];

  const minutes1050Options = [
    { label: "0m", value: 0 },
    { label: "10m", value: 60 * 10 },
    { label: "20m", value: 60 * 20 },
    { label: "30m", value: 60 * 30 },
    { label: "40m", value: 60 * 40 },
    { label: "50m", value: 60 * 50 },
  ];

  const addingTimer = (values) => {
    addTimer(values.title, values.hours1 + values.hours2 + values.minutes1 + values.minutes2);
    setShow(false);
    form.resetFields();
  };

  const updateView = () => {
    const values = form.getFieldsValue();
    setTheHour(_ => (values.hours1+values.hours2) / (60*60));
    setTheMinute(_ => (values.minutes1+values.minutes2) / (60));
  }

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
        visible={show}
        width={417}
        title="Add Timer"
        onCancel={() => {
          setShow(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Typography.Title level={2}>
          <span>{theHour} <small className={styles.small_note}>hours</small></span> 
          <span className={styles.minutes_note}>{theMinute} <small className={styles.small_note}>minutes</small></span>
        </Typography.Title>
        <Form
          form={form}
          size="large"
          onFinish={addingTimer}
          onFieldsChange={(_, __) => updateView()}
          initialValues={{ hours1: 60 * 60, hours2: 0, minutes1: 0, minutes2: 0 }}
        >
          <Item name="title" required={true}>
            <Input placeholder="eg. Focus on Works" />
          </Item>
          <Divider>Hours</Divider>
          <Item name="hours1" required={true} className={styles.radio_group}>
            <Radio.Group
              className={styles.radio_items}
              options={hourOptions}
              optionType="button"
              buttonStyle="solid"
            />
          </Item>
          <Item name="hours2" required={true} className={styles.radio_group}>
            <Radio.Group
              className={styles.radio_items}
              options={hourOptions}
              optionType="button"
              buttonStyle="solid"
            />
          </Item>
          <Divider>Minutes</Divider>
          <Item name="minutes1" required={true} className={styles.radio_group}>
            <Radio.Group
              className={styles.radio_items}
              options={minutes1050Options}
              optionType="button"
              buttonStyle="solid"
            />
          </Item>
          <Item name="minutes2" required={true} className={styles.radio_group}>
            <Radio.Group
              className={styles.radio_items}
              options={minutes09Options}
              optionType="button"
              buttonStyle="solid"
            />
          </Item>
        </Form>
      </Modal>
    </>
  );
}

export default AddTimer;
