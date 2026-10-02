import { BarChartOutlined, CloseOutlined, EditOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Grid, List, Popconfirm, Row, Typography, theme } from "antd";
import { useContext, useEffect, useRef, useState } from "react";
import { store } from "../redux/store";
import { useDay } from "../redux/day";
import { DAY_NAMES, weekDateOf } from "../utilities/day-helper";
import {
  BALANCE_RANGE,
  balanceLabel,
  dailyCount,
  dailyWeek,
  routineWeek,
  weekStartOf,
} from "../utilities/habit-helper";
import HabitForm from "./HabitForm";
import HabitHistory from "./HabitHistory";
import styles from "./AppHabits.module.css";

const { Title, Text } = Typography;

const SECTIONS = {
  daily: {
    title: "Daily",
    empty: "Habits with a set number per day, like praying 5 times",
  },
  routine: {
    title: "Routines",
    empty: "Tap − when you slip, + when you hold on. A slip is a debt you pay back",
  },
};

// History, edit and delete for one habit.
function HabitActions({ habit, size, onHistory, onEdit, onDelete }) {
  return (
    <span className={styles.actions}>
      <Button size={size} type="link" icon={<BarChartOutlined />} aria-label={`History of ${habit.name}`} title="History" onClick={onHistory} />
      <Button size={size} type="link" icon={<EditOutlined />} aria-label={`Edit ${habit.name}`} title="Edit" onClick={onEdit} />
      <Popconfirm
        title={`Delete "${habit.name}"?`}
        description="Its history is deleted too."
        okText="Delete"
        okButtonProps={{ danger: true }}
        onConfirm={onDelete}
      >
        <Button size={size} type="link" danger icon={<CloseOutlined />} aria-label={`Delete ${habit.name}`} title="Delete" />
      </Popconfirm>
    </span>
  );
}

// A row of slots for the viewed day. Tapping an empty slot fills up to it;
// tapping the last filled one empties it, so a mis-tap is one tap to undo.
function DailyHabit({ habit, actions }) {
  const { setDailyCount } = useContext(store);
  const { selectedDay, todayDate, today } = useDay();
  const date = weekDateOf(selectedDay, todayDate);
  const future = date > todayDate;
  const count = dailyCount(habit, date);
  const week = dailyWeek(habit, weekStartOf(todayDate));
  const when = selectedDay === today ? "today" : `on ${DAY_NAMES[selectedDay]}`;
  const { token } = theme.useToken();

  const tap = (index) => setDailyCount(habit.id, date, index + 1 === count ? index : index + 1);

  return (
    <div className={styles.habit}>
      <Row justify="space-between" align="middle" wrap={false}>
        <Text strong className={styles.name}>{habit.name}</Text>
        {actions}
      </Row>
      <div className={styles.slots} role="group" aria-label={`${habit.name} ${when}`}>
        {Array.from({ length: habit.target }, (_, i) => (
          <button
            key={i}
            type="button"
            className={styles.slot}
            style={{ borderColor: token.colorPrimary, background: i < count ? token.colorPrimary : "transparent" }}
            aria-label={`${habit.name} ${i + 1} of ${habit.target}`}
            aria-pressed={i < count}
            disabled={future}
            onClick={() => tap(i)}
          />
        ))}
      </div>
      <Text type="secondary" className={styles.metaText}>
        {future ? `Can't fill ${DAY_NAMES[selectedDay]} yet` : `${count}/${habit.target} ${when}`}
        {" · "}
        <span data-testid={`week-${habit.id}`}>{week.done}/{week.possible} this week</span>
      </Text>
    </div>
  );
}

// −/+ around the name, and a marker that drifts left as debt builds up and
// right once it's paid off. This week's balance; it starts clear each Monday.
function RoutineHabit({ habit, actions, size }) {
  const { logRoutine } = useContext(store);
  const { todayDate } = useDay();
  const { token } = theme.useToken();
  const { balance } = routineWeek(habit, weekStartOf(todayDate));
  const [last, setLast] = useState(null);
  const undoTimer = useRef();

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const tap = (field) => {
    logRoutine(habit.id, field, 1, todayDate);
    setLast(field);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setLast(null), 8000);
  };

  const undo = () => {
    logRoutine(habit.id, last, -1, todayDate);
    setLast(null);
    clearTimeout(undoTimer.current);
  };

  const clamped = Math.max(-BALANCE_RANGE, Math.min(BALANCE_RANGE, balance));
  const position = 50 + (clamped / BALANCE_RANGE) * 50;
  const color = balance < 0 ? token.colorError : balance > 0 ? token.colorPrimary : token.colorTextSecondary;

  return (
    <div className={styles.habit}>
      <Row justify="space-between" align="middle" wrap={false}>
        <Text strong className={styles.name}>{habit.name}</Text>
        {actions}
      </Row>
      <Row align="middle" wrap={false} className={styles.routine}>
        {/* Neutral, not red: logging a slip honestly should never feel like a penalty. */}
        <Button size={size} shape="circle" icon={<MinusOutlined />} aria-label={`Slipped on ${habit.name}`} onClick={() => tap("minus")} />
        <div className={styles.track} style={{ background: token.colorFillSecondary }} aria-hidden="true">
          <span className={styles.center} style={{ background: token.colorBorder }} />
          <span
            className={styles.fill}
            style={{
              left: `${Math.min(position, 50)}%`,
              width: `${Math.abs(position - 50)}%`,
              background: color,
            }}
          />
          <span className={styles.marker} style={{ left: `${position}%`, borderColor: color, background: token.colorBgContainer }} />
        </div>
        <Button size={size} shape="circle" type="primary" ghost icon={<PlusOutlined />} aria-label={`Held on with ${habit.name}`} onClick={() => tap("plus")} />
      </Row>
      <Row justify="space-between" align="middle" className={styles.meta}>
        <Text style={{ color }} aria-live="polite" data-testid={`balance-${habit.id}`}>
          {balanceLabel(balance)}
        </Text>
        {last ? (
          <Button type="link" size="small" className={styles.undo} onClick={undo}>
            Undo {last === "plus" ? "+1" : "−1"}
          </Button>
        ) : (
          <Text type="secondary">This week</Text>
        )}
      </Row>
    </div>
  );
}

function HabitSection({ kind }) {
  const { habits, addHabit, editHabit, deleteHabit } = useContext(store);
  const { todayDate } = useDay();
  const [form, setForm] = useState(null); // { habit } while adding/editing
  const [history, setHistory] = useState(null);
  const isMobile = !!Grid.useBreakpoint().xs;
  const size = isMobile ? "large" : "small";
  const section = SECTIONS[kind];
  const items = habits.filter((habit) => habit.kind === kind);

  return (
    <section aria-label={section.title}>
      <List
        header={
          <Row justify="space-between" align="middle">
            <Title level={3} style={{ fontWeight: 300 }} className="no-margin-important">
              {section.title}
            </Title>
            <Button
              icon={<PlusOutlined />}
              size={isMobile ? "large" : "middle"}
              aria-label={`Add ${section.title.toLowerCase()} habit`}
              onClick={() => setForm({ habit: null })}
            />
          </Row>
        }
        locale={{ emptyText: section.empty }}
        dataSource={items}
        rowKey="id"
        renderItem={(habit) => {
          const actions = (
            <HabitActions
              habit={habit}
              size={size}
              onHistory={() => setHistory(habit.id)}
              onEdit={() => setForm({ habit })}
              onDelete={() => deleteHabit(habit.id)}
            />
          );
          return (
            <List.Item className={styles.item}>
              {kind === "daily" ? (
                <DailyHabit habit={habit} actions={actions} />
              ) : (
                <RoutineHabit habit={habit} actions={actions} size={isMobile ? "large" : "middle"} />
              )}
            </List.Item>
          );
        }}
      />
      <HabitForm
        kind={kind}
        habit={form?.habit}
        open={!!form}
        size={isMobile ? "large" : undefined}
        onSubmit={(name, target) =>
          form?.habit ? editHabit(form.habit.id, name, target) : addHabit(kind, name, target)
        }
        onClose={() => setForm(null)}
      />
      {history && habits.some((habit) => habit.id === history) && (
        <HabitHistory
          habit={habits.find((habit) => habit.id === history)}
          todayDate={todayDate}
          onClose={() => setHistory(null)}
        />
      )}
    </section>
  );
}

// Two habit types, kept apart because they work differently: Daily fills a
// set number of slots per day; Routines keep a +/- balance for the week.
function AppHabits() {
  return (
    <>
      <HabitSection kind="daily" />
      <div className={styles.gap}>
        <HabitSection kind="routine" />
      </div>
    </>
  );
}

export default AppHabits;
