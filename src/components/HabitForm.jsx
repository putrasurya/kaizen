import { Form, Input, InputNumber, Modal } from "antd";
import { useLayoutEffect } from "react";
import { MAX_TARGET } from "../utilities/habit-helper";

const DEFAULT_TARGET = 5;

const COPY = {
  daily: { add: "New daily habit", placeholder: "eg. Pray", targetLabel: "Times per day" },
  routine: { add: "New routine", placeholder: "eg. Hold off smoking" },
};

// Add (no `habit`) or edit a habit's name, plus the daily target. Any label
// works, emoji included, so private habits needn't be spelled out on screen.
function HabitForm({ kind, habit, open, size, onSubmit, onClose }) {
  const [form] = Form.useForm();
  const copy = COPY[kind];

  // Every open starts from the habit being edited, or blank for a new one.
  // The form instance outlives the modal, so without this it would reopen
  // with whatever was last typed. Layout effect: set before the first paint,
  // so old values never flash.
  useLayoutEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue({ name: habit?.name ?? "", target: habit?.target ?? DEFAULT_TARGET });
  }, [open, habit, form]);

  const handleFinish = ({ name, target }) => {
    if (!name?.trim()) return;
    onSubmit(name, target);
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
      </Form>
    </Modal>
  );
}

export default HabitForm;
