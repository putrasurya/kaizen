import { CheckOutlined, LeftOutlined, PlusOutlined, RightOutlined, TrophyOutlined } from "@ant-design/icons";
import { Alert, Button, Form, Input, Modal, Popconfirm, Progress, Space, Typography } from "antd";
import { useContext, useLayoutEffect, useState } from "react";
import { MILESTONE_NOTE_MAX, MILESTONE_TITLE_MAX, milestoneYear, store } from "../redux/store";
import { toDateKey } from "../utilities/day-helper";
import { shortDate } from "../utilities/habit-helper";
import styles from "./Milestones.module.css";

const { Text, Title } = Typography;

const isComposing = (e) => e.nativeEvent?.isComposing;

// The date a new milestone in `year` starts at: today in the current year,
// the last day of an earlier one.
const defaultDateFor = (year, today) => (String(year) === today.slice(0, 4) ? today : `${year}-12-31`);

const FORM_TITLES = {
  goal: "Edit goal",
  milestone: "Edit milestone",
  achieve: "Achieved!",
  add: "Add a milestone",
};

// Add a milestone directly, mark a goal achieved, or edit either one.
// `mode`: "add" | "achieve" | "goal" | "milestone".
function MilestoneForm({ mode, milestone, year, today, onClose }) {
  const { addMilestone, updateMilestone, deleteMilestone } = useContext(store);
  const [form] = Form.useForm();
  const withDate = mode !== "goal";

  useLayoutEffect(() => {
    form.resetFields();
    form.setFieldsValue({
      title: milestone?.title ?? "",
      note: milestone?.note ?? "",
      date: milestone?.achievedOn ?? (mode === "achieve" ? today : defaultDateFor(year, today)),
    });
  }, [form, milestone, mode, year, today]);

  const handleFinish = ({ title, note, date }) => {
    if (mode === "add") addMilestone({ title, note, achievedOn: date });
    else if (mode === "achieve") updateMilestone(milestone.id, { note, achievedOn: date });
    else if (mode === "goal") updateMilestone(milestone.id, { title, note });
    else updateMilestone(milestone.id, { title, note, achievedOn: date });
    onClose();
  };

  const deletable = mode === "goal" || mode === "milestone";

  return (
    <Modal
      open
      title={FORM_TITLES[mode]}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <div className={styles.formFooter}>
          {deletable ? (
            <Popconfirm
              title={`Delete "${milestone.title}"?`}
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                deleteMilestone(milestone.id);
                onClose();
              }}
            >
              <Button danger type="text">
                Delete
              </Button>
            </Popconfirm>
          ) : (
            <span />
          )}
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" onClick={() => form.submit()}>
              {mode === "achieve" ? "Mark achieved" : mode === "add" ? "Add" : "Save"}
            </Button>
          </Space>
        </div>
      }
    >
      {mode === "achieve" && <Text strong className={styles.achieveTitle}>{milestone.title}</Text>}
      <Form form={form} name={`milestone-${mode}`} layout="vertical" onFinish={handleFinish}>
        {mode !== "achieve" && (
          <Form.Item
            label={mode === "goal" ? "Goal" : "Milestone"}
            name="title"
            rules={[{ required: true, whitespace: true, message: "Give it a title" }]}
          >
            <Input placeholder="Got the AWS certification" maxLength={MILESTONE_TITLE_MAX} autoFocus />
          </Form.Item>
        )}
        {withDate && (
          <Form.Item
            label="Date"
            name="date"
            rules={[
              { required: true, message: "When did it happen?" },
              {
                validator: (_, value) =>
                  !value || value <= today ? Promise.resolve() : Promise.reject(new Error("That date hasn't come yet")),
              },
            ]}
          >
            <Input type="date" max={today} />
          </Form.Item>
        )}
        <Form.Item label="Note (optional)" name="note">
          <Input.TextArea
            placeholder={mode === "goal" ? "Why it matters, or how you'll get there" : "Score 87%, second try"}
            autoSize={{ minRows: 2, maxRows: 5 }}
            maxLength={MILESTONE_NOTE_MAX}
            autoFocus={mode === "achieve"}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

// Your own record of the year: what you reached (a dated timeline), and what
// you still want to reach (goals). Anything goes, not only habits.
function Milestones({ open, onClose }) {
  const { milestones, addMilestone, settleOldGoals } = useContext(store);
  const today = toDateKey();
  const thisYear = Number(today.slice(0, 4));
  const [year, setYear] = useState(thisYear);
  const [goalText, setGoalText] = useState("");
  const [form, setForm] = useState(null); // { mode, milestone }

  const firstYear = Math.min(thisYear, ...milestones.map(milestoneYear));
  const lastYear = thisYear + 1;
  const inYear = milestones.filter((m) => milestoneYear(m) === year);
  const achieved = inYear
    .filter((m) => m.achievedOn)
    .sort((a, b) => b.achievedOn.localeCompare(a.achievedOn) || b.id - a.id);
  const goals = inYear.filter((m) => !m.achievedOn);
  const past = year < thisYear;
  const percent = inYear.length ? Math.round((achieved.length / inYear.length) * 100) : 0;
  const leftover = milestones.filter((m) => !m.achievedOn && !m.kept && m.year < thisYear);

  const addGoal = () => {
    if (!goalText.trim()) return;
    addMilestone({ title: goalText, year });
    setGoalText("");
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      title={
        <span>
          <TrophyOutlined aria-hidden="true" /> Milestones
        </span>
      }
    >
      <div className={styles.yearBar}>
        <Button
          type="text"
          icon={<LeftOutlined />}
          aria-label="Previous year"
          disabled={year <= firstYear}
          onClick={() => setYear((y) => y - 1)}
        />
        <Title level={4} className={styles.year} aria-live="polite">
          {year}
        </Title>
        <Button
          type="text"
          icon={<RightOutlined />}
          aria-label="Next year"
          disabled={year >= lastYear}
          onClick={() => setYear((y) => y + 1)}
        />
      </div>
      <Text type="secondary" className={styles.count} data-testid="milestone-count">
        {inYear.length ? `${achieved.length} of ${inYear.length} reached` : "Nothing here yet"}
      </Text>
      <Progress percent={percent} showInfo={false} size="small" aria-label={`${percent}% reached`} />

      {year === thisYear && leftover.length > 0 && (
        <Alert
          className={styles.carry}
          type="info"
          showIcon
          message={`${leftover.length} ${leftover.length === 1 ? "goal" : "goals"} from earlier years ${
            leftover.length === 1 ? "wasn't" : "weren't"
          } reached.`}
          description={
            <Space wrap>
              <Button type="primary" size="small" onClick={() => settleOldGoals(thisYear, true)}>
                Bring into {thisYear}
              </Button>
              <Button size="small" onClick={() => settleOldGoals(thisYear, false)}>
                {leftover.length === 1 ? "Leave it there" : "Leave them there"}
              </Button>
            </Space>
          }
        />
      )}

      <div className={styles.sectionHead}>
        <Text type="secondary">Achieved</Text>
        {year <= thisYear && (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setForm({ mode: "add" })}>
            Add milestone
          </Button>
        )}
      </div>
      {achieved.length ? (
        <ol className={styles.timeline} aria-label={`Achieved in ${year}`}>
          {achieved.map((m) => (
            <li key={m.id} className={styles.entry}>
              <span className={styles.dot} aria-hidden="true" />
              <button type="button" className={styles.entryButton} onClick={() => setForm({ mode: "milestone", milestone: m })}>
                <Text type="secondary" className={styles.date}>
                  {shortDate(m.achievedOn)}
                </Text>
                <Text strong className={styles.title}>
                  {m.title}
                </Text>
                {m.note && (
                  <Text type="secondary" className={styles.note}>
                    {m.note}
                  </Text>
                )}
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <Text type="secondary" className={styles.empty}>
          {past ? "Nothing recorded for this year." : "When you reach something, it shows up here with its date."}
        </Text>
      )}

      <div className={styles.sectionHead}>
        <Text type="secondary">{past ? "Not reached" : "Still to come"}</Text>
      </div>
      {!past && (
        <Space.Compact block className={styles.addGoal}>
          <Input
            aria-label="New goal"
            placeholder={`Add a goal for ${year}`}
            value={goalText}
            maxLength={MILESTONE_TITLE_MAX}
            onChange={(e) => setGoalText(e.target.value)}
            onPressEnter={(e) => !isComposing(e) && addGoal()}
          />
          <Button type="primary" icon={<PlusOutlined />} aria-label="Add goal" disabled={!goalText.trim()} onClick={addGoal} />
        </Space.Compact>
      )}
      {goals.length ? (
        <ul className={styles.goals} aria-label={past ? `Not reached in ${year}` : `Goals for ${year}`}>
          {goals.map((m) => (
            <li key={m.id} className={styles.goal}>
              <span className={styles.ring} aria-hidden="true" />
              <button type="button" className={styles.goalTitle} onClick={() => setForm({ mode: "goal", milestone: m })}>
                {m.title}
                {m.note && <Text type="secondary" className={styles.note}>{m.note}</Text>}
              </button>
              {year <= thisYear && (
                <Button
                  size="small"
                  icon={<CheckOutlined />}
                  aria-label={`Mark "${m.title}" achieved`}
                  onClick={() => setForm({ mode: "achieve", milestone: m })}
                >
                  Achieved
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <Text type="secondary" className={styles.empty}>
          {past ? "Everything you set out to do here was reached, or there were no goals." : "What do you want to reach this year?"}
        </Text>
      )}

      {form && (
        <MilestoneForm
          mode={form.mode}
          milestone={form.milestone}
          year={year}
          today={today}
          onClose={() => setForm(null)}
        />
      )}
    </Modal>
  );
}

export default Milestones;
