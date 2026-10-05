import { Alert, Button, Checkbox, Modal, Select, Space, Typography } from "antd";
import { useState } from "react";
import { usePrivacy } from "../redux/privacy";
import { RELOCK_OPTIONS } from "../utilities/privacy-lock";
import { useNow } from "../utilities/useNow";
import PinPad from "./PinPad";
import { waitText, wrongText } from "./LockScreen";
import styles from "./PrivacySettings.module.css";

const { Paragraph, Text } = Typography;

const WHAT_IT_DOES =
  "Hides Kaizen behind a 4-digit PIN, for when someone else picks up your device. " +
  "Your data stays on this device and isn't encrypted.";

// Turning the lock on: choose a PIN, enter it again, then agree that a
// forgotten PIN means losing the data.
function Setup({ onDone }) {
  const { enable } = usePrivacy();
  const [step, setStep] = useState("choose");
  const [pin, setPin] = useState(null);
  const [relockAfter, setRelockAfter] = useState(0);
  const [understood, setUnderstood] = useState(false);
  const [message, setMessage] = useState(null);
  const [shake, setShake] = useState(0);

  if (step === "choose" || step === "confirm") {
    return (
      <>
        <PinPad
          key={step}
          label={step === "choose" ? "Choose a 4-digit PIN" : "Enter it again"}
          shake={shake}
          onComplete={(entered) => {
            if (step === "choose") {
              setPin(entered);
              setMessage(null);
              setStep("confirm");
            } else if (entered === pin) {
              setStep("confirm-risk");
            } else {
              setMessage("Those didn't match. Choose a PIN again.");
              setShake((n) => n + 1);
              setStep("choose");
            }
          }}
        />
        <Text type="danger" className={styles.message} aria-live="assertive">
          {message}
        </Text>
      </>
    );
  }

  return (
    <>
      <Alert
        type="warning"
        showIcon
        message="A forgotten PIN can't be recovered"
        description="There's no account or server behind Kaizen. If you forget this PIN, the only way back in is to erase all your Kaizen data on this device."
      />
      <label className={styles.field}>
        <Text>Lock again when I come back</Text>
        <Select value={relockAfter} onChange={setRelockAfter} options={RELOCK_OPTIONS} style={{ width: "100%" }} />
      </label>
      <Checkbox checked={understood} onChange={(e) => setUnderstood(e.target.checked)} className={styles.agree}>
        I understand that forgetting my PIN means losing my data.
      </Checkbox>
      <Button
        type="primary"
        block
        size="large"
        disabled={!understood}
        onClick={async () => {
          await enable(pin, relockAfter);
          onDone();
        }}
      >
        Turn on privacy lock
      </Button>
    </>
  );
}

// Asks for the current PIN (counting towards the same wait as the lock
// screen) before turning the lock off or changing the PIN.
function ConfirmCurrent({ label, onConfirmed }) {
  const { attempt, lock } = usePrivacy();
  const [message, setMessage] = useState(null);
  const [shake, setShake] = useState(0);
  const now = useNow(1000);
  const waiting = lock?.waitUntil > now;

  return (
    <>
      <PinPad
        label={label}
        disabled={waiting}
        shake={shake}
        onComplete={async (pin) => {
          const result = await attempt(pin);
          if (result.ok) return onConfirmed();
          setShake((n) => n + 1);
          setMessage(result.waitUntil > Date.now() ? null : wrongText(result));
        }}
      />
      <Text type="danger" className={styles.message} aria-live="assertive">
        {waiting ? waitText(lock.waitUntil, now) : message}
      </Text>
    </>
  );
}

function ChangePin({ onDone }) {
  const { changePin } = usePrivacy();
  const [step, setStep] = useState("current");
  const [pin, setPin] = useState(null);
  const [message, setMessage] = useState(null);

  if (step === "current") return <ConfirmCurrent label="Enter your current PIN" onConfirmed={() => setStep("choose")} />;

  return (
    <>
      <PinPad
        key={step}
        label={step === "choose" ? "Choose a new PIN" : "Enter the new PIN again"}
        onComplete={async (entered) => {
          if (step === "choose") {
            setPin(entered);
            setMessage(null);
            setStep("confirm");
          } else if (entered === pin) {
            await changePin(entered);
            onDone("PIN changed.");
          } else {
            setMessage("Those didn't match. Choose a new PIN again.");
            setStep("choose");
          }
        }}
      />
      <Text type="danger" className={styles.message} aria-live="assertive">
        {message}
      </Text>
    </>
  );
}

function PrivacySettings({ open, onClose }) {
  const { enabled, lock, locked, setRelockAfter, lockNow, disable } = usePrivacy();
  const [mode, setMode] = useState("view");
  const [notice, setNotice] = useState(null);

  const close = () => {
    setMode("view");
    setNotice(null);
    onClose();
  };
  const back = (text = null) => {
    setMode("view");
    setNotice(text);
  };

  let body;
  if (mode === "setup") body = <Setup onDone={() => back("Privacy lock is on.")} />;
  else if (mode === "change") body = <ChangePin onDone={back} />;
  else if (mode === "off")
    body = (
      <ConfirmCurrent
        label="Enter your PIN to turn the lock off"
        onConfirmed={() => {
          disable();
          back("Privacy lock is off.");
        }}
      />
    );
  else if (!enabled)
    body = (
      <>
        <Paragraph>{WHAT_IT_DOES}</Paragraph>
        <Button type="primary" block size="large" onClick={() => setMode("setup")}>
          Set up a PIN
        </Button>
      </>
    );
  else
    body = (
      <>
        <Paragraph>{WHAT_IT_DOES}</Paragraph>
        <label className={styles.field}>
          <Text>Lock again when I come back</Text>
          <Select
            value={lock.relockAfter}
            onChange={setRelockAfter}
            options={RELOCK_OPTIONS}
            style={{ width: "100%" }}
          />
        </label>
        <Space direction="vertical" style={{ width: "100%" }}>
          <Button
            block
            size="large"
            onClick={() => {
              close();
              lockNow();
            }}
          >
            Lock now
          </Button>
          <Button block size="large" onClick={() => setMode("change")}>
            Change PIN
          </Button>
          <Button block size="large" danger onClick={() => setMode("off")}>
            Turn off privacy lock
          </Button>
        </Space>
      </>
    );

  return (
    <Modal
      open={open && !locked}
      title="Privacy lock"
      footer={
        mode === "view" ? null : (
          <Button onClick={() => back()}>Back</Button>
        )
      }
      onCancel={close}
      destroyOnHidden
    >
      {notice && <Alert type="success" message={notice} showIcon className={styles.notice} />}
      <div className={styles.body}>{body}</div>
    </Modal>
  );
}

export default PrivacySettings;
