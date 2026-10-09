import { Form, Input, InputNumber, Modal, Switch, Typography } from "antd";
import { useLayoutEffect } from "react";
import { DEFAULT_POMODORO } from "../utilities/pomodoro";
import TimerDurationPicker from "./TimerDurationPicker";
import styles from "./TimerForm.module.css";

const { Text } = Typography;
const { Item } = Form;

const toValues = (timer) => {
  const pomodoro = timer?.pomodoro ?? DEFAULT_POMODORO;
  return {
    title: timer?.title ?? "",
    seconds: timer?.seconds ?? 60 * 60,
    pomodoroOn: !!timer?.pomodoro,
    breakMinutes: pomodoro.breakSeconds / 60,
    longBreakMinutes: pomodoro.longBreakSeconds / 60,
    longEvery: pomodoro.longEvery,
    autoBreak: pomodoro.autoBreak,
  };
};

// Add a timer (no `timer`) or edit one: title, length, and Pomodoro breaks.
// Calls `onSubmit({ title, seconds, pomodoro })`, pomodoro null when off.
function TimerForm({ open, title, okText, timer, onSubmit, onClose }) {
  const [form] = Form.useForm();
  const pomodoroOn = Form.useWatch("pomodoroOn", form);

  useLayoutEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(toValues(timer));
  }, [open, timer, form]);

  const handleFinish = (values) => {
    onSubmit({
      title: values.title.trim(),
      seconds: values.seconds,
      pomodoro: values.pomodoroOn
        ? {
            breakSeconds: values.breakMinutes * 60,
            longBreakSeconds: values.longBreakMinutes * 60,
            longEvery: values.longEvery,
            autoBreak: values.autoBreak,
          }
        : null,
    });
    onClose();
  };

  return (
    <Modal open={open} width={440} title={title} okText={okText} onCancel={onClose} onOk={() => form.submit()} destroyOnHidden>
      <Form form={form} name={timer ? `timer-edit-${timer.id}` : "timer-add"} size="large" layout="vertical" onFinish={handleFinish}>
        <Item name="title" label="Title" rules={[{ required: true, whitespace: true, message: "Give it a title" }]}>
          <Input placeholder="Deep work" maxLength={80} />
        </Item>
        <Item
          name="seconds"
          label={pomodoroOn ? "Focus round" : "Length"}
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

        <div className={styles.switchRow}>
          <label htmlFor={`${timer ? `timer-edit-${timer.id}` : "timer-add"}_pomodoroOn`}>Pomodoro breaks</label>
          <Item name="pomodoroOn" valuePropName="checked" noStyle>
            <Switch />
          </Item>
        </div>
        <Text type="secondary" className={styles.hint}>
          {pomodoroOn
            ? "After each round: a short break, and a long one every few rounds."
            : "Off: when it reaches zero it adds a rep and is ready to go again."}
        </Text>

        {pomodoroOn && (
          <div className={styles.grid}>
            <Item name="breakMinutes" label="Short break" rules={[{ required: true, message: "How long?" }]}>
              <InputNumber min={1} max={60} precision={0} addonAfter="min" style={{ width: "100%" }} />
            </Item>
            <Item name="longBreakMinutes" label="Long break" rules={[{ required: true, message: "How long?" }]}>
              <InputNumber min={1} max={120} precision={0} addonAfter="min" style={{ width: "100%" }} />
            </Item>
            <Item name="longEvery" label="Long break every" rules={[{ required: true, message: "How often?" }]}>
              <InputNumber min={2} max={12} precision={0} addonAfter="rounds" style={{ width: "100%" }} />
            </Item>
            <div className={styles.switchCell}>
              <label htmlFor={`${timer ? `timer-edit-${timer.id}` : "timer-add"}_autoBreak`}>Start breaks automatically</label>
              <Item name="autoBreak" valuePropName="checked" noStyle>
                <Switch />
              </Item>
            </div>
          </div>
        )}
      </Form>
    </Modal>
  );
}

export default TimerForm;
