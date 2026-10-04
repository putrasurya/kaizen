import { HistoryOutlined } from "@ant-design/icons";
import { Button, Empty, Grid, Input, Modal, Row, Tag, Typography } from "antd";
import { useContext, useEffect, useRef, useState } from "react";
import { JOURNAL_MAX_LENGTH, store } from "../redux/store";
import { useDay } from "../redux/day";
import { DAY_NAMES, weekDateOf } from "../utilities/day-helper";
import { daySummary, longDate } from "../utilities/habit-helper";
import styles from "./AppJournal.module.css";

const { Title, Text, Paragraph } = Typography;

const SAVE_DELAY = 500;
const PAGE_SIZE = 20;
const PROMPT = "How did today go? What went well, and what would you do better tomorrow?";

// The habits as they stood on `date`, so rereading an entry shows what
// actually happened that day next to what was written about it.
function DaySummary({ date }) {
  const { habits } = useContext(store);
  const items = daySummary(habits, date);
  if (!items.length) return null;

  return (
    <ul className={styles.summary} aria-label="Habits that day">
      {items.map((item) => (
        <li key={item.id}>
          <Tag color={item.done ? "blue" : item.owed ? "red" : undefined} className={styles.tag}>
            <span className={styles.tagName}>{item.name}</span> {item.text}
          </Tag>
        </li>
      ))}
    </ul>
  );
}

// One date's entry. Typing saves after a short pause, and anything pending is
// saved straight away on blur or when the date changes (the parent keys this
// by date, so switching days unmounts it).
function JournalEditor({ date, size }) {
  const { journal, setJournalEntry } = useContext(store);
  const [text, setText] = useState(() => journal[date] ?? "");
  const [status, setStatus] = useState(null);
  const pending = useRef(null);
  const timer = useRef();
  const save = useRef();

  save.current = () => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    setJournalEntry(date, pending.current);
    pending.current = null;
  };

  useEffect(() => () => save.current(), []);

  const handleChange = (e) => {
    const value = e.target.value;
    setText(value);
    pending.current = value;
    setStatus("Saving…");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      save.current();
      setStatus("Saved");
    }, SAVE_DELAY);
  };

  const handleBlur = () => {
    if (pending.current === null) return;
    save.current();
    setStatus("Saved");
  };

  return (
    <>
      <Input.TextArea
        aria-label={`Journal for ${longDate(date)}`}
        placeholder={PROMPT}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        autoSize={{ minRows: 3, maxRows: 14 }}
        maxLength={JOURNAL_MAX_LENGTH}
        size={size}
        className={styles.editor}
      />
      <Text type="secondary" className={styles.status} aria-live="polite">
        {status ?? (text.trim() ? "Saved on this device" : " ")}
      </Text>
    </>
  );
}

// Every entry except the one being edited, newest first. Older weeks can't be
// reached from the day picker, so this is where they're read.
function PastEntries({ exclude, todayDate, onClose }) {
  const { journal } = useContext(store);
  const [shown, setShown] = useState(PAGE_SIZE);
  const dates = Object.keys(journal)
    .filter((date) => date !== exclude && date <= todayDate)
    .sort()
    .reverse();

  return (
    <Modal open title="Past entries" footer={null} onCancel={onClose} width={640}>
      {dates.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No other entries yet" />
      ) : (
        <ol className={styles.past}>
          {dates.slice(0, shown).map((date) => (
            <li key={date} className={styles.entry}>
              <Text strong>{longDate(date, todayDate)}</Text>
              <DaySummary date={date} />
              <Paragraph className={styles.entryText}>{journal[date]}</Paragraph>
            </li>
          ))}
        </ol>
      )}
      {dates.length > shown && (
        <Button block onClick={() => setShown((n) => n + PAGE_SIZE)}>
          Show older entries
        </Button>
      )}
    </Modal>
  );
}

// A diary entry per calendar date, for the day picked in the day picker.
// Unlike Reminders, which repeat every week, each entry stays on its date.
function AppJournal() {
  const { journal } = useContext(store);
  const { selectedDay, todayDate } = useDay();
  const [showPast, setShowPast] = useState(false);
  const isMobile = !!Grid.useBreakpoint().xs;
  const date = weekDateOf(selectedDay, todayDate);
  const future = date > todayDate;
  const pastCount = Object.keys(journal).filter((d) => d !== date && d <= todayDate).length;

  return (
    <section aria-label="Journal">
      <Row justify="space-between" align="middle" className={styles.header}>
        <Title level={3} style={{ fontWeight: 300 }} className="no-margin-important">
          Journal
        </Title>
        <Button
          icon={<HistoryOutlined />}
          size={isMobile ? "large" : "middle"}
          onClick={() => setShowPast(true)}
          disabled={pastCount === 0}
        >
          Past entries
        </Button>
      </Row>
      <Text type="secondary" className={styles.date}>
        {longDate(date)}
      </Text>
      <DaySummary date={date} />
      {future ? (
        <Text type="secondary" className={styles.future}>
          Come back on {DAY_NAMES[selectedDay]} to write this one.
        </Text>
      ) : (
        <JournalEditor key={date} date={date} size={isMobile ? "large" : "middle"} />
      )}
      {showPast && <PastEntries exclude={date} todayDate={todayDate} onClose={() => setShowPast(false)} />}
    </section>
  );
}

export default AppJournal;
