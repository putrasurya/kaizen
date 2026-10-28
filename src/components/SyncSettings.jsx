import { CloudOutlined, CloudSyncOutlined, GoogleOutlined } from "@ant-design/icons";
import { Alert, Badge, Button, Modal, Radio, Space, Typography } from "antd";
import { useState } from "react";
import { useSync } from "../sync/SyncProvider";
import { backupFromState, normalizeState } from "../redux/store";
import { toDateKey } from "../utilities/day-helper";
import { describeState, downloadJson } from "./BackupSettings";
import { useNow } from "../utilities/useNow";
import styles from "./SyncSettings.module.css";

const { Paragraph, Text } = Typography;

const ATTENTION = new Set(["needs-sign-in", "needs-choice", "update-app", "error"]);

export function ago(then, now) {
  if (!then) return "not yet";
  const minutes = Math.floor((now - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// Header button: a cloud, spinning while syncing, with a dot when sync needs
// a tap. Hidden in copies of Kaizen without a Google client ID.
export function SyncButton({ onClick }) {
  const { configured, enabled, status } = useSync();
  if (!configured) return null;
  const label = !enabled ? "Sync with Google Drive" : ATTENTION.has(status) ? "Sync needs attention" : "Sync";
  return (
    <Badge dot={ATTENTION.has(status)} color="gold" offset={[-6, 6]}>
      <Button
        type="text"
        icon={status === "syncing" ? <CloudSyncOutlined spin /> : <CloudOutlined />}
        aria-label={label}
        title={label}
        onClick={onClick}
      />
    </Badge>
  );
}

function JoinChoice({ onChoose }) {
  const [choice, setChoice] = useState("drive");
  return (
    <div className={styles.choice}>
      <Paragraph strong>Google Drive already has Kaizen data, and so does this device.</Paragraph>
      <Radio.Group value={choice} onChange={(e) => setChoice(e.target.value)} className={styles.options}>
        <Radio value="drive">
          <Text>Use the data in Google Drive</Text>
          <Paragraph type="secondary" className={styles.optionNote}>
            Best for a second device. What&apos;s on this device is replaced.
          </Paragraph>
        </Radio>
        <Radio value="combine">
          <Text>Combine both</Text>
          <Paragraph type="secondary" className={styles.optionNote}>
            Keeps everything from both. Where both have the same item, the higher count is kept; the same text edited
            on both keeps the latest.
          </Paragraph>
        </Radio>
      </Radio.Group>
      <Text type="secondary">Either way, a copy of this device&apos;s data is kept aside first.</Text>
      <Button type="primary" onClick={() => onChoose(choice)}>
        Continue
      </Button>
    </div>
  );
}

function Status() {
  const { status, message, lastSyncedAt, syncNow, choose } = useSync();
  const now = useNow();

  switch (status) {
    case "syncing":
      return <Text type="secondary">Syncing…</Text>;
    case "needs-sign-in":
      return (
        <Alert
          type="warning"
          showIcon
          message="Google sign-in has run out"
          description="It lasts about an hour. Your changes are safe here and sync once you continue."
          action={
            <Button size="small" type="primary" onClick={syncNow}>
              Continue syncing
            </Button>
          }
        />
      );
    case "needs-choice":
      return <JoinChoice onChoose={choose} />;
    case "update-app":
      return (
        <Alert
          type="warning"
          showIcon
          message="Update Kaizen on this device"
          description="Another device saved data from a newer Kaizen. Close every Kaizen tab or window and open it again to update, then sync."
        />
      );
    case "offline":
      return <Text type="secondary">You&apos;re offline. Kaizen syncs when you&apos;re back online.</Text>;
    case "error":
      return (
        <Alert
          type="error"
          showIcon
          message="Sync didn't finish"
          description={message}
          action={
            <Button size="small" onClick={syncNow}>
              Try again
            </Button>
          }
        />
      );
    default:
      return <Text type="secondary">Last synced {ago(lastSyncedAt, now)}</Text>;
  }
}

// The data this device had before it joined Drive, kept aside.
function KeptCopy() {
  const { hasKeptCopy, keptCopy, forgetKeptCopy } = useSync();
  if (!hasKeptCopy) return null;
  const state = keptCopy();
  if (!state) return null;

  const download = () => {
    const now = new Date();
    downloadJson(`kaizen-before-sync-${toDateKey(now)}.json`, backupFromState(normalizeState(state), now));
  };

  return (
    <Alert
      type="info"
      className={styles.alert}
      message="This device's data from before syncing is kept aside"
      description={
        <>
          <Paragraph className={styles.keptText}>
            {describeState(normalizeState(state))}. Download it as a backup file (you can restore it from Backup &amp;
            restore), or remove it once you don&apos;t need it.
          </Paragraph>
          <Space wrap>
            <Button size="small" onClick={download}>
              Download it
            </Button>
            <Button size="small" type="text" onClick={forgetKeptCopy}>
              Remove it
            </Button>
          </Space>
        </>
      }
    />
  );
}

function SyncSettings({ open, onClose }) {
  const { enabled, status, email, message, turnOn, turnOff, syncNow } = useSync();
  const [busy, setBusy] = useState(false);

  const handleTurnOn = async () => {
    setBusy(true);
    try {
      await turnOn();
    } finally {
      setBusy(false);
    }
  };

  const handleTurnOff = () => {
    Modal.confirm({
      title: "Turn off sync on this device?",
      content: "This device stops syncing. Your data stays here and in Google Drive, and your other devices keep syncing.",
      okText: "Turn off",
      onOk: turnOff,
    });
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title="Sync with Google Drive" width={480}>
      {!enabled ? (
        <>
          <Paragraph>
            Keep Kaizen the same on your phone and computer. Your data is saved in a hidden Kaizen folder in your own
            Google Drive: Kaizen can&apos;t see your other files, and the folder doesn&apos;t show up in Drive.
          </Paragraph>
          <Paragraph type="secondary">Your PIN lock stays separate on each device.</Paragraph>
          {message && <Alert type="error" showIcon message={message} className={styles.alert} />}
          <Button type="primary" icon={<GoogleOutlined />} loading={busy} onClick={handleTurnOn}>
            Sign in with Google
          </Button>
        </>
      ) : (
        <>
          <Paragraph>
            Syncing{email ? (
              <>
                {" "}
                with <Text strong>{email}</Text>
              </>
            ) : null}
            .
          </Paragraph>
          <div className={styles.status} aria-live="polite">
            <Status />
          </div>
          <KeptCopy />
          <Space wrap className={styles.actions}>
            <Button onClick={syncNow} disabled={status === "syncing" || status === "needs-choice"}>
              Sync now
            </Button>
            <Button type="text" danger onClick={handleTurnOff}>
              Turn off sync
            </Button>
          </Space>
        </>
      )}
    </Modal>
  );
}

export default SyncSettings;
