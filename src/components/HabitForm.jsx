import { Form, Input, InputNumber, Modal, Radio, Switch, Typography } from "antd";
import { useLayoutEffect } from "react";
import { MAX_TARGET } from "../utilities/habit-helper";
import { AUTO_LIMITS } from "../utilities/auto-tap";

const { Text } = Typography;

const DEFAULT_TARGET = 5;
const DEFAULT_AUTO = { direction: "plus", everyMinutes: 60, maxPerDay: 8 };

const COPY = {
  daily: { add: "New daily habit", placeholder: "eg. Pray", targetLabel: "Times per day" },
  routine: { add: "New routine", placeholder: "eg. Hold off smoking" },
};

const initialValues = (habit) => {
  const auto = habit?.auto ?? DEFAULT_AUTO;
  return {
    name: habit?.name ?? "",
    target: habit?.target ?? DEFAULT_TARGET,
    autoOn: !!habit?.auto,
    autoDirection: auto.direction,
    autoEvery: auto.everyMinutes,
    autoMax: auto.maxPerDay,
  };
};

// Add (no `habit`) or edit a habit's name, plus the daily target, or a
// routine's auto tap. Any label works, emoji included, so private habits
// needn't be spelled out on screen.
function HabitForm({ kind, habit, open, size, onSubmit, onClose }) {
  const [form] = Form.useForm();
  const copy = COPY[kind];
  const autoOn = Form.useWatch("autoOn", form);
  const direction = Form.useWatch("autoDirection", form);

  // Every open starts from the habit being edited, or blank for a new one.
  // The form instance outlives the modal, so without this it would reopen
  // with whatever was last typed. Layout effect: set before the first paint,
  // so old values never flash.
  useLayoutEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(initialValues(habit));
  }, [open, habit, form]);

  const handleFinish = ({ name, target, autoOn, autoDirection, autoEvery, autoMax }) => {
    if (!name?.trim()) return;
    // Routines always send their auto setting (null = off); daily habits none.
    const auto =
      kind === "routine"
        ? autoOn
          ? { direction: autoDirection, everyMinutes: autoEvery, maxPerDay: autoMax }
          : null
        : undefined;
    onSubmit(name, target, auto);
    onClose();
  };

  return (
    <Modal
      open={open}
      title={habit ? `Edit "${habit.name}"` : copy.add}
      okText={habit ? "Save" : "Add"}
      onOk={() => form.submit()}
      onCancel={onClose}
      destroyOnHidden
    >
      {/* Named per kind, so the Daily and Routines forms never share field ids. */}
      <Form form={form} name={`habit-${kind}`} layout="vertical" size={size} onFinish={handleFinish}>
        <Form.Item
          label="Name"
          name="name"
          rules={[{ required: true, whitespace: true, message: "Give it a name" }]}
        >
          <Input placeholder={copy.placeholder} maxLength={60} autoFocus />
        </Form.Item>
        {kind === "daily" && (
          <Form.Item label={copy.targetLabel} name="target" rules={[{ required: true, message: "How many times?" }]}>
            <InputNumber min={1} max={MAX_TARGET} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        )}
        {kind === "routine" && (
          <>
            <Form.Item
              label="Auto tap"
              name="autoOn"
              valuePropName="checked"
              extra="Taps for you on a timer, even while the app is closed. A tap the other way restarts the timer."
            >
              <Switch />
            </Form.Item>
            {autoOn && (
              <>
                <Form.Item label="Direction" name="autoDirection">
                  <Radio.Group
                    optionType="button"
                    buttonStyle="solid"
                    options={[
                      { value: "plus", label: "+1 (credit)" },
                      { value: "minus", label: "−1 (debt)" },
                    ]}
                  />
                </Form.Item>
                <Text type="secondary" style={{ display: "block", marginTop: -12, marginBottom: 16 }}>
                  {direction === "minus"
                    ? "For something to do regularly: debt builds up, and you tap + when you do it."
                    : "For something to resist: credit builds up, and you tap − when you slip."}
                </Text>
                <div style={{ display: "flex", gap: 12 }}>
                  <Form.Item
                    label="Every (minutes)"
                    name="autoEvery"
                    style={{ flex: 1 }}
                    rules={[{ required: true, message: "How often?" }]}
                  >
                    <InputNumber
                      min={AUTO_LIMITS.minEvery}
                      max={AUTO_LIMITS.maxEvery}
                      precision={0}
                      style={{ width: "100%" }}
                    />
                  </Form.Item>
                  <Form.Item
                    label="Max per day"
                    name="autoMax"
                    style={{ flex: 1 }}
                    rules={[{ required: true, message: "Up to how many?" }]}
                  >
                    <InputNumber min={AUTO_LIMITS.minMax} max={AUTO_LIMITS.maxMax} precision={0} style={{ width: "100%" }} />
                  </Form.Item>
                </div>
              </>
            )}
          </>
        )}
      </Form>
    </Modal>
  );
}

export default HabitForm;
