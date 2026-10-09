import { LockOutlined, SaveOutlined, TrophyOutlined, UnlockOutlined } from "@ant-design/icons";
import { Button, Col, Row, Space, Tooltip, Typography } from "antd";
import { useContext, useState } from "react";
import { store } from "./redux/store";
import AppNote from "./components/AppNote";
import AppTimer from "./components/AppTimer";
import AppTodo from "./components/AppTodo";
import AppHabits from "./components/AppHabits";
import AppJournal from "./components/AppJournal";
import DayPicker from "./components/DayPicker";
import styles from './App.module.css';
import AppFooter from "./components/AppFooter";
import { DayProvider } from "./redux/day";
import { PrivacyProvider, usePrivacy } from "./redux/privacy";
import LockScreen from "./components/LockScreen";
import PrivacySettings from "./components/PrivacySettings";
import BackupSettings from "./components/BackupSettings";
import Milestones from "./components/Milestones";

const { Title, Text } = Typography;

function PrivacyButton() {
  const { enabled } = usePrivacy();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="text"
        icon={enabled ? <LockOutlined /> : <UnlockOutlined />}
        aria-label="Privacy lock"
        title="Privacy lock"
        onClick={() => setOpen(true)}
      />
      <PrivacySettings open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function AppContent() {
  const hourLeftForToday = 24 - new Date().getHours();
  const { locked, covered } = usePrivacy();
  const { generation } = useContext(store);
  const [backupOpen, setBackupOpen] = useState(false);
  const [milestonesOpen, setMilestonesOpen] = useState(false);
  const hidden = locked || covered;

  return (
    <DayProvider>
      {/* Locked = covered by LockScreen, and unreachable by keyboard or screen
          reader. Still mounted, so running timers keep going. */}
      {/* Keyed by `generation`: restoring a backup rebuilds the page so every
          section shows the restored data. */}
      <div key={generation} className={styles.container} inert={hidden} aria-hidden={hidden || undefined}>
        <Row justify="space-between" align="middle" className={styles.header}>
          <Title level={2} style={{ fontWeight: 300 }} className="no-margin-important">
            Kaizen
          </Title>
          <Space size={4} align="center">
            <Tooltip title="Represent times left from 24 hours of today" className={styles.hide_on_mobile}>
              <Text>{hourLeftForToday}h/24h</Text>
            </Tooltip>
            <Button
              type="text"
              icon={<TrophyOutlined />}
              aria-label="Milestones"
              title="Milestones"
              onClick={() => setMilestonesOpen(true)}
            />
            <Button
              type="text"
              icon={<SaveOutlined />}
              aria-label="Backup & restore"
              title="Backup & restore"
              onClick={() => setBackupOpen(true)}
            />
            <PrivacyButton />
          </Space>
        </Row>
        {/* One picker for the whole page: every section follows it. */}
        <DayPicker />
        {/* Source order is the phone order (timers, habits, todos, journal,
            reminders in one column). From lg up, todos + journal + reminders
            move to the left column and timers + habits to the right, via the
            lg order props. */}
        <Row className={styles.appwrapper} gutter={[{ xs: 32, sm: 50 }, 50]} data-testid="sections">
          <Col span={24} lg={{ order: 2, span: 12 }}>
            <AppTimer />
            <div className={styles.section_gap}>
              <AppHabits />
            </div>
          </Col>
          <Col span={24} lg={{ order: 1, span: 12 }}>
            <AppTodo />
            <div className={styles.section_gap}>
              <AppJournal />
            </div>
            <div className={styles.section_gap}>
              <AppNote />
            </div>
          </Col>
        </Row>
        <AppFooter />
      </div>
      {/* Outside the keyed page, so it stays open (with its Undo) after a restore. */}
      <BackupSettings open={backupOpen} onClose={() => setBackupOpen(false)} />
      <Milestones open={milestonesOpen} onClose={() => setMilestonesOpen(false)} />
      <LockScreen />
    </DayProvider>
  );
}

function App() {
  return (
    <PrivacyProvider>
      <AppContent />
    </PrivacyProvider>
  );
}

export default App;
