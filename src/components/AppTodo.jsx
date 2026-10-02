import { CloseOutlined, CopyOutlined, EditOutlined, PlusOutlined } from "@ant-design/icons";
import { Button, Checkbox, Col, Grid, Input, List, Row, Space, Typography } from "antd";
import { useContext, useRef, useState } from "react";
import { store, hasIdenticalTodo, isTodoDone } from "../redux/store";
import { useDay } from "../redux/day";
import { DAY_NAMES, weekDateOf } from "../utilities/day-helper";
import CopyToDays from "./CopyToDays";
import styles from "./AppTodo.module.css";

const { Title, Text } = Typography;

// Enter while an IME is composing (e.g. Japanese input) confirms the
// composition, not the field.
const isComposing = (e) => e.nativeEvent?.isComposing;

// Inline editor for a todo's text: Enter or leaving the field saves, Escape
// cancels. Blank text is ignored by the store, so the old text stays.
function TodoEditor({ todo, size, onSave, onDone }) {
  const cancelled = useRef(false);

  const finish = (value) => {
    if (!cancelled.current) onSave(value);
    onDone();
  };

  return (
    <Input
      autoFocus
      size={size}
      aria-label="Edit todo"
      defaultValue={todo.text}
      onPressEnter={(e) => !isComposing(e) && finish(e.target.value)}
      onBlur={(e) => finish(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        cancelled.current = true;
        onDone();
      }}
    />
  );
}

// The selected day's checklist. Ticks only count for this week's date of that
// weekday (see isTodoDone), so each list starts unchecked again next week.
function AppTodo() {
  const { todos, addTodo, setTodoDone, renameTodo, copyTodo, deleteTodo } = useContext(store);
  const { selectedDay, todayDate } = useDay();
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [copying, setCopying] = useState(null);
  // Phones: 40px touch targets, and a large (16px) input so iOS doesn't zoom.
  const isMobile = !!Grid.useBreakpoint().xs;
  const buttonSize = isMobile ? "large" : "small";

  const dayTodos = todos.filter((todo) => todo.day === selectedDay);
  const isDone = (todo) => isTodoDone(todo, todayDate);
  // Open items first, done ones after, each group in the order written. The
  // store keeps that order, so un-ticking puts an item back where it was.
  const items = [...dayTodos.filter((todo) => !isDone(todo)), ...dayTodos.filter(isDone)];
  const doneCount = dayTodos.length - dayTodos.filter((todo) => !isDone(todo)).length;

  const handleAdd = () => {
    if (!text.trim()) return;
    addTodo(text, selectedDay);
    setText("");
  };

  const handleToggle = (todo, checked) => {
    setTodoDone(todo.id, checked ? weekDateOf(todo.day, todayDate) : null);
  };

  return (
    <section aria-label="Todo">
      <List
        className={styles.list}
        header={
          <>
            <Row justify="space-between" align="middle">
              <Title level={3} style={{ fontWeight: 300 }} className="no-margin-important">
                Todo
              </Title>
              <Text type="secondary" data-testid="todo-count">
                {doneCount}/{dayTodos.length} done
              </Text>
            </Row>
            <Space.Compact block className={styles.add}>
              <Input
                size={isMobile ? "large" : "middle"}
                aria-label="New todo"
                placeholder={`Add a todo for ${DAY_NAMES[selectedDay]}`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPressEnter={(e) => !isComposing(e) && handleAdd()}
              />
              <Button
                type="primary"
                size={isMobile ? "large" : "middle"}
                icon={<PlusOutlined />}
                aria-label="Add todo"
                disabled={!text.trim()}
                onClick={handleAdd}
              />
            </Space.Compact>
          </>
        }
        locale={{ emptyText: `Nothing to do on ${DAY_NAMES[selectedDay]} yet` }}
        dataSource={items}
        rowKey="id"
        renderItem={(todo) => {
          const done = isDone(todo);
          return (
            <List.Item className={styles.item}>
              <Row wrap={false} align="middle" style={{ width: "100%" }}>
                <Col flex="none">
                  <Checkbox
                    className={styles.check}
                    aria-label={todo.text}
                    checked={done}
                    onChange={(e) => handleToggle(todo, e.target.checked)}
                  />
                </Col>
                <Col flex="auto" className={styles.text}>
                  {editingId === todo.id ? (
                    <TodoEditor
                      todo={todo}
                      size={isMobile ? "large" : "middle"}
                      onSave={(value) => renameTodo(todo.id, value)}
                      onDone={() => setEditingId(null)}
                    />
                  ) : (
                    <span className={done ? styles.done : undefined}>{todo.text}</span>
                  )}
                </Col>
                <Col flex="none">
                  <Button
                    size={buttonSize}
                    type="link"
                    icon={<EditOutlined />}
                    aria-label="Edit"
                    title="Edit"
                    onClick={() => setEditingId(todo.id)}
                  />
                  <Button
                    size={buttonSize}
                    type="link"
                    icon={<CopyOutlined />}
                    aria-label="Copy to other days"
                    title="Copy to other days"
                    onClick={() => setCopying(todo)}
                  />
                  <Button
                    size={buttonSize}
                    type="link"
                    danger
                    icon={<CloseOutlined />}
                    aria-label="Delete"
                    title="Delete"
                    onClick={() => deleteTodo(todo.id)}
                  />
                </Col>
              </Row>
            </List.Item>
          );
        }}
      />
      {copying && (
        <CopyToDays
          open
          title={copying.text}
          day={copying.day}
          isDuplicate={(day) => hasIdenticalTodo(todos, copying, day)}
          hint="Copies start not done. Days that already have this todo are skipped."
          onCopy={(days) => copyTodo(copying.id, days)}
          onClose={() => setCopying(null)}
        />
      )}
    </section>
  );
}

export default AppTodo;
