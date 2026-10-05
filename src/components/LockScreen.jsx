import { LockOutlined } from "@ant-design/icons";
import { Button, Input, Typography } from "antd";
import { useState } from "react";
import { usePrivacy } from "../redux/privacy";
import { useNow } from "../utilities/useNow";
import PinPad from "./PinPad";
import styles from "./LockScreen.module.css";

const { Title, Text, Paragraph } = Typography;
const ERASE_WORD = "ERASE";

export function waitText(waitUntil, now) {
  const seconds = Math.max(1, Math.ceil((waitUntil - now) / 1000));
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `Too many tries. Try again in ${m}:${s}.`;
}

export function wrongText(result) {
  if (result.triesLeft > 0) {
    return `Wrong PIN. ${result.triesLeft} ${result.triesLeft === 1 ? "try" : "tries"} left before a wait.`;
  }
  return "Wrong PIN.";
}

// The only way past a forgotten PIN: erase everything on this device.
function ForgotPin({ onCancel }) {
  const { erase } = usePrivacy();
  const [typed, setTyped] = useState("");

  return (
    <div className={styles.forgot} role="group" aria-label="Forgot PIN">
      <Title level={4}>Erase everything?</Title>
      <Paragraph type="secondary">
        A forgotten PIN can't be recovered. The only way back in is to erase all your Kaizen data on this device:
        timers, todos, habits, journal and reminders. This can't be undone.
      </Paragraph>
      <Input
        aria-label={`Type ${ERASE_WORD} to confirm`}
        placeholder={`Type ${ERASE_WORD} to confirm`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        size="large"
      />
      <div className={styles.forgotActions}>
        <Button size="large" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="large" danger type="primary" disabled={typed.trim() !== ERASE_WORD} onClick={erase}>
          Erase everything
        </Button>
      </div>
    </div>
  );
}

// Full-screen cover over the app. The app stays mounted underneath, so
// running timers and their alarms keep going while it's locked.
function LockScreen() {
  const { locked, covered, lock, unlock } = usePrivacy();
  const [message, setMessage] = useState(null);
  const [shake, setShake] = useState(0);
  const [forgot, setForgot] = useState(false);
  const now = useNow(1000);

  if (!locked && !covered) return null;

  if (!locked) {
    return (
      <div className={styles.overlay} aria-hidden="true">
        <Title level={2} className={styles.brand}>
          Kaizen
        </Title>
      </div>
    );
  }

  const waiting = lock.waitUntil > now;

  const handleComplete = async (pin) => {
    const result = await unlock(pin);
    if (result.ok) {
      setMessage(null);
      return;
    }
    setShake((n) => n + 1);
    setMessage(result.waitUntil > Date.now() ? null : wrongText(result));
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Kaizen is locked">
      {forgot ? (
        <ForgotPin onCancel={() => setForgot(false)} />
      ) : (
        <>
          <LockOutlined className={styles.icon} aria-hidden="true" />
          <Title level={3} className={styles.title}>
            Kaizen is locked
          </Title>
          <PinPad label="Enter your PIN" onComplete={handleComplete} disabled={waiting} shake={shake} />
          <Text type="danger" className={styles.message} aria-live="assertive">
            {waiting ? waitText(lock.waitUntil, now) : message}
          </Text>
          <Button type="link" onClick={() => setForgot(true)}>
            Forgot PIN?
          </Button>
        </>
      )}
    </div>
  );
}

export default LockScreen;
