import { ArrowLeftOutlined } from "@ant-design/icons";
import { Typography } from "antd";
import { useEffect, useRef, useState } from "react";
import { PIN_LENGTH } from "../utilities/privacy-lock";
import styles from "./PinPad.module.css";

const { Text } = Typography;
const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", null, "0", "back"];

// Four dots and a number pad. Calls `onComplete(pin)` once the fourth digit is
// in, then clears for the next try. Digits and Backspace on a keyboard work
// too, while `captureKeys` is on (only one pad on screen should listen).
function PinPad({ label, onComplete, disabled = false, captureKeys = true, shake = 0 }) {
  const [digits, setDigits] = useState("");
  const current = useRef("");
  const busy = useRef(false);
  const handlers = useRef();

  const set = (value) => {
    current.current = value;
    setDigits(value);
  };

  handlers.current = {
    press(digit) {
      if (disabled || busy.current || current.current.length >= PIN_LENGTH) return;
      const next = current.current + digit;
      set(next);
      if (next.length < PIN_LENGTH) return;
      busy.current = true;
      Promise.resolve(onComplete(next)).finally(() => {
        busy.current = false;
        set("");
      });
    },
    back() {
      if (disabled || busy.current) return;
      set(current.current.slice(0, -1));
    },
  };

  useEffect(() => {
    if (!captureKeys) return undefined;
    const onKey = (e) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea, [contenteditable=true]")) return;
      if (/^\d$/.test(e.key)) handlers.current.press(e.key);
      else if (e.key === "Backspace") handlers.current.back();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [captureKeys]);

  return (
    <div className={styles.pad}>
      {label && <Text className={styles.label}>{label}</Text>}
      <div
        key={shake}
        className={`${styles.dots} ${shake ? styles.shake : ""}`}
        role="status"
        aria-label={`${digits.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <span key={i} className={`${styles.dot} ${i < digits.length ? styles.filled : ""}`} />
        ))}
      </div>
      <div className={styles.keys}>
        {KEYS.map((key, i) =>
          key === null ? (
            <span key={i} />
          ) : key === "back" ? (
            <button
              key={i}
              type="button"
              className={`${styles.key} ${styles.backKey}`}
              aria-label="Delete last digit"
              disabled={disabled || !digits}
              onClick={() => handlers.current.back()}
            >
              <ArrowLeftOutlined />
            </button>
          ) : (
            <button
              key={i}
              type="button"
              className={styles.key}
              disabled={disabled}
              onClick={() => handlers.current.press(key)}
            >
              {key}
            </button>
          )
        )}
      </div>
    </div>
  );
}

export default PinPad;
