import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { Alert, Button, Divider, Modal, Space, Typography } from "antd";
import { useContext, useRef, useState } from "react";
import { BACKUP_MAX_BYTES, BackupError, backupFromState, stateFromBackup, store } from "../redux/store";
import { toDateKey } from "../utilities/day-helper";

const { Title, Paragraph, Text } = Typography;

const storageKey = () => import.meta.env.VITE_STORAGEKEY;
const lastExportKey = () => `${storageKey()}.last-export`;
const beforeImportKey = () => `${storageKey()}.before-import`;

const read = (key) => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: nothing to remember.
  }
};

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "3 timers, 12 todos, 2 habits, 20 journal entries, 5 reminders"
export function describeState(state) {
  return [
    plural(state.timers.length, "timer"),
    plural(state.todos.length, "todo"),
    plural(state.habits.length, "habit"),
    plural(Object.keys(state.journal).length, "journal entry", "journal entries"),
    plural(state.notes.length, "reminder"),
  ].join(", ");
}

function formatWhen(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "an unknown date";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function lastBackupText(iso, now = Date.now()) {
  if (!iso) return "Never backed up on this device.";
  const days = Math.floor((now - new Date(iso).getTime()) / (24 * 3600 * 1000));
  const ago = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
  return `Last backup: ${ago} (${formatWhen(iso)}).`;
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

function BackupSettings({ open, onClose }) {
  const { fullState, replaceAll } = useContext(store);
  const [lastExport, setLastExport] = useState(() => read(lastExportKey()));
  const [pending, setPending] = useState(null); // { state, exportedAt, fileName }
  const [error, setError] = useState(null);
  const [restored, setRestored] = useState(null); // state before the restore, for undo
  const fileInput = useRef();

  const reset = () => {
    setPending(null);
    setError(null);
    setRestored(null);
  };

  const handleExport = () => {
    const now = new Date();
    downloadJson(`kaizen-backup-${toDateKey(now)}.json`, backupFromState(fullState, now));
    write(lastExportKey(), now.toISOString());
    setLastExport(now.toISOString());
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again still triggers a change
    if (!file) return;
    reset();
    if (file.size > BACKUP_MAX_BYTES) {
      setError("This file is too big to be a Kaizen backup.");
      return;
    }
    try {
      const result = stateFromBackup(await file.text());
      setPending({ ...result, fileName: file.name });
    } catch (err) {
      setError(err instanceof BackupError ? err.message : "This file couldn't be read.");
    }
  };

  const handleRestore = () => {
    // A copy of what's being replaced, kept until the next restore, so a
    // wrong file isn't the end of the world.
    write(beforeImportKey(), JSON.stringify(fullState));
    setRestored(fullState);
    replaceAll(pending.state);
    setPending(null);
  };

  const handleUndo = () => {
    replaceAll(restored);
    write(beforeImportKey(), null);
    setRestored(null);
  };

  return (
    <Modal
      open={open}
      title="Backup & restore"
      footer={null}
      onCancel={() => {
        reset();
        onClose();
      }}
      destroyOnHidden
    >
      <Title level={5}>Back up</Title>
      <Paragraph type="secondary">
        Saves everything (timers, todos, habits, journal and reminders) as a file. Keep it somewhere safe, like your
        cloud drive. The file isn&apos;t encrypted, so treat it like your diary.
      </Paragraph>
      <Paragraph data-testid="last-backup">{lastBackupText(lastExport)}</Paragraph>
      <Button type="primary" icon={<DownloadOutlined />} block size="large" onClick={handleExport}>
        Download backup
      </Button>

      <Divider />

      <Title level={5}>Restore</Title>
      <Paragraph type="secondary">
        Replaces everything in Kaizen on this device with a backup file. Your privacy lock PIN stays the same.
      </Paragraph>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        hidden
        aria-label="Backup file"
        onChange={handleFile}
      />
      {!pending && !restored && (
        <Button icon={<UploadOutlined />} block size="large" onClick={() => fileInput.current.click()}>
          Choose backup file
        </Button>
      )}

      {error && <Alert type="error" showIcon message={error} style={{ marginTop: 16 }} />}

      {pending && (
        <Alert
          type="warning"
          showIcon
          message="Replace everything with this backup?"
          description={
            <Space direction="vertical" style={{ width: "100%" }}>
              <Text>
                {pending.exportedAt ? `Backup from ${formatWhen(pending.exportedAt)}: ` : `${pending.fileName}: `}
                {describeState(pending.state)}.
              </Text>
              <Text>What&apos;s in Kaizen now ({describeState(fullState)}) will be replaced.</Text>
              <Space wrap>
                <Button danger type="primary" onClick={handleRestore}>
                  Replace my data
                </Button>
                <Button onClick={() => setPending(null)}>Cancel</Button>
              </Space>
            </Space>
          }
        />
      )}

      {restored && (
        <Alert
          type="success"
          showIcon
          message="Restored from backup."
          action={
            <Button size="small" onClick={handleUndo}>
              Undo
            </Button>
          }
        />
      )}
    </Modal>
  );
}

export default BackupSettings;
