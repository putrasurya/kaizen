import { Form, Input, InputNumber, Modal } from "antd";
import { MAX_TARGET } from "../utilities/habit-helper";

const COPY = {
  daily: { add: "New daily habit", placeholder: "eg. Pray", targetLabel: "Times per day" },
  routine: { add: "New routine", placeholder: "eg. Hold off smoking" },
};

// Add (no `habit`) or edit a habit's name, plus the daily target. Any label
// works, emoji included, so private habits needn't be spelled out on screen.
function HabitForm({ kind, habit, open, size, onSubmit, onClose }) {
  const [form] = Form.useForm();
  const copy = COPY[kind];

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
      {/* Destroyed on close, so each open starts from these values. */}
      <Form
        form={form}
        layout="vertical"
        size={size}
        initialValues={{ name: habit?.name ?? "", target: habit?.target ?? 5 }}
        onFinish={handleFinish}
      >
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
