import { createContext, useReducer, useState } from "react";
import { DAYS, getTodayKey, isDateKey, isDayKey, toDateKey, weekDateOf } from "../utilities/day-helper";
import { isHabitKind, toTarget } from "../utilities/habit-helper";
import { toAutoSettings, withAutoSettings } from "../utilities/auto-tap";

// Bump when the persisted shape changes, and add a step to migrateState().
// 1 (implicit, no `version` field): timers had no `day`.
// 2: every timer belongs to exactly one weekday via `day`.
// 3: notes belong to a weekday too, and there is a per-day `todos` list.
// 4: a `habits` list (daily slots and +/- routines, see habit-helper).
// 5: a `journal` of entries keyed by calendar date ("YYYY-MM-DD").
// 6: routines can auto tap (`auto`), and save when each manual tap happened.
// 7: a `milestones` list (achieved milestones and goals for the year).
export const STATE_VERSION = 7;

export const MILESTONE_TITLE_MAX = 120;
export const MILESTONE_NOTE_MAX = 500;

export const JOURNAL_MAX_LENGTH = 10000;

const emptyState = () => ({
  version: STATE_VERSION,
  timers: [],
  notes: [],
  todos: [],
  habits: [],
  journal: {},
  milestones: [],
  embeds: [],
});

// Ids used to be plain Date.now() values, which collide when several records
// are created in one action (copies, migration). Keep them numeric and
// time-based, but strictly increasing past every id already in use.
function idGenerator(items) {
  let last = items.reduce((max, item) => (Number.isFinite(item.id) ? Math.max(max, item.id) : max), 0);
  return () => {
    last = Math.max(Date.now(), last + 1);
    return last;
  };
}

// Gives every record a unique numeric id, keeping the first use of each valid
// one. Returns the records and a generator for further fresh ids.
function withUniqueIds(items) {
  const nextId = idGenerator(items);
  const seen = new Set();
  const unique = items.map((item) => {
    const id = Number.isFinite(item.id) && !seen.has(item.id) ? item.id : nextId();
    seen.add(id);
    return id === item.id ? item : { ...item, id };
  });
  return [unique, nextId];
}

// Records whose day is missing/invalid (hand-edited, partially written) show
// up today rather than vanishing.
const onValidDay = (items, today) =>
  items.map((item) => (isDayKey(item.day) ? item : { ...item, day: today }));

const isRecord = (raw) => !!raw && typeof raw === "object" && !Array.isArray(raw);

const sanitizeList = (list, sanitize) =>
  (Array.isArray(list) ? list : []).map(sanitize).filter(Boolean);

// A copy keeps the timer's settings and starts with fresh runtime state.
function copyTimerTo(timer, day, id) {
  return { ...timer, id, day, secondsSpent: 0, reps: 0 };
}

// "Identical" = same settings on that day, so copying again would only add a
// duplicate.
export function hasIdenticalTimer(timers, timer, day) {
  return timers.some(
    (other) =>
      other.id !== timer.id &&
      other.day === day &&
      other.title === timer.title &&
      other.seconds === timer.seconds &&
      other.initial === timer.initial
  );
}

const toCount = (value, fallback = 0) =>
  Number.isFinite(value) && value >= 0 ? value : fallback;

// A todo is a recurring item on its weekday's checklist. `doneOn` is the date
// it was ticked for, and it only counts while it is that weekday's date in the
// current (Monday-first) week. So every week's list starts unchecked again,
// without anything having to run at midnight or while the app is closed.
export function isTodoDone(todo, todayDate) {
  return todo.doneOn != null && todo.doneOn === weekDateOf(todo.day, todayDate);
}

export function hasIdenticalTodo(todos, todo, day) {
  return todos.some((other) => other.id !== todo.id && other.day === day && other.text === todo.text);
}

// Coerces one persisted timer into a usable shape, or drops it (null) if it
// isn't even an object. Ids are de-duplicated by the caller.
function sanitizeTimer(raw) {
  if (!isRecord(raw)) return null;
  const seconds = toCount(raw.seconds);
  return {
    ...raw,
    title: typeof raw.title === "string" ? raw.title : String(raw.title ?? ""),
    seconds,
    secondsSpent: Math.min(toCount(raw.secondsSpent), seconds),
    initial: toCount(raw.initial, seconds),
    reps: toCount(raw.reps),
  };
}

function sanitizeNote(raw) {
  if (!isRecord(raw)) return null;
  return { ...raw, content: typeof raw.content === "string" ? raw.content : String(raw.content ?? "") };
}

// A todo without usable text can't be shown or edited, so it's dropped.
function sanitizeTodo(raw) {
  if (!isRecord(raw) || typeof raw.text !== "string" || !raw.text.trim()) return null;
  return { id: raw.id, day: raw.day, text: raw.text, doneOn: isDateKey(raw.doneOn) ? raw.doneOn : null };
}

const toWhole = (value) => (Number.isInteger(value) && value > 0 ? value : 0);

// Keeps only dated entries with something in them, so the log stays small.
function sanitizeLog(raw, sanitizeEntry) {
  const log = {};
  if (!isRecord(raw)) return log;
  for (const [date, entry] of Object.entries(raw)) {
    if (!isDateKey(date)) continue;
    const clean = sanitizeEntry(entry);
    if (clean) log[date] = clean;
  }
  return log;
}

const dailyEntry = (entry) => toWhole(entry) || null;
// Tap times restart the auto-tap clock. A day only needs the recent ones.
const MAX_TAP_TIMES = 200;
const toTimes = (list) =>
  (Array.isArray(list) ? list : []).filter((t) => Number.isFinite(t) && t > 0).slice(-MAX_TAP_TIMES);

const isEmptyRoutineEntry = (entry) => !(entry.plus || entry.minus || entry.autoPlus || entry.autoMinus);

function routineEntry(entry) {
  if (!isRecord(entry)) return null;
  const clean = { plus: toWhole(entry.plus), minus: toWhole(entry.minus) };
  const plusAt = toTimes(entry.plusAt);
  const minusAt = toTimes(entry.minusAt);
  if (plusAt.length) clean.plusAt = plusAt;
  if (minusAt.length) clean.minusAt = minusAt;
  if (toWhole(entry.autoPlus)) clean.autoPlus = toWhole(entry.autoPlus);
  if (toWhole(entry.autoMinus)) clean.autoMinus = toWhole(entry.autoMinus);
  return isEmptyRoutineEntry(clean) ? null : clean;
}

// Auto-tap settings plus when they started; anything unusable means "off".
function sanitizeAuto(raw) {
  const settings = toAutoSettings(raw);
  if (!settings) return null;
  return {
    ...settings,
    since: Number.isFinite(raw.since) && raw.since > 0 ? raw.since : Date.now(),
    frozenThrough: isDateKey(raw.frozenThrough) ? raw.frozenThrough : null,
  };
}

// A habit needs a kind and a name to be shown; anything else is repaired.
// `createdOn` starts its history, so earlier weeks don't read as missed; if
// it's lost, the first logged day stands in.
function sanitizeHabit(raw) {
  if (!isRecord(raw) || !isHabitKind(raw.kind) || typeof raw.name !== "string" || !raw.name.trim()) return null;
  const log = sanitizeLog(raw.log, raw.kind === "daily" ? dailyEntry : routineEntry);
  const createdOn = isDateKey(raw.createdOn) ? raw.createdOn : Object.keys(log).sort()[0] ?? toDateKey();
  const base = { id: raw.id, kind: raw.kind, name: raw.name, createdOn };
  return raw.kind === "daily"
    ? { ...base, target: toTarget(raw.target), log }
    : { ...base, log, auto: sanitizeAuto(raw.auto) };
}

const updateHabit = (state, id, change) => ({
  ...state,
  habits: state.habits.map((habit) => (habit.id === id ? change(habit) : habit)),
});

function withLogEntry(habit, date, entry) {
  const log = { ...habit.log };
  if (entry) log[date] = entry;
  else delete log[date];
  return { ...habit, log };
}

// Unlike notes (which repeat every week on their weekday), a journal entry
// belongs to one calendar date. Blank entries are simply absent.
function sanitizeJournal(raw) {
  const journal = {};
  if (!isRecord(raw)) return journal;
  for (const [date, text] of Object.entries(raw)) {
    if (isDateKey(date) && typeof text === "string" && text.trim()) journal[date] = text.slice(0, JOURNAL_MAX_LENGTH);
  }
  return journal;
}

// A milestone is anything worth remembering from the year, written by the
// user: "Got the AWS certification". With `achievedOn` (a date) it's reached
// and belongs to that date's year; without, it's a goal for `year`. A goal
// from a past year can be `kept` there as "not reached" instead of carried
// into the new year.
const isYear = (value) => Number.isInteger(value) && value >= 2000 && value <= 2100;
const cleanText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export const milestoneYear = (milestone) =>
  milestone.achievedOn ? Number(milestone.achievedOn.slice(0, 4)) : milestone.year;

function sanitizeMilestone(raw) {
  if (!isRecord(raw)) return null;
  const title = cleanText(raw.title, MILESTONE_TITLE_MAX);
  if (!title) return null;
  const achievedOn = isDateKey(raw.achievedOn) ? raw.achievedOn : null;
  const year = achievedOn ? Number(achievedOn.slice(0, 4)) : isYear(raw.year) ? raw.year : new Date().getFullYear();
  return { id: raw.id, title, note: cleanText(raw.note, MILESTONE_NOTE_MAX), achievedOn, year, kept: !achievedOn && raw.kept === true };
}

function migrateState(parsed, today) {
  const version = Number.isFinite(parsed.version) ? parsed.version : 1;

  // Every record needs a unique numeric id before copies are made from it.
  let [timers, nextTimerId] = withUniqueIds(sanitizeList(parsed.timers, sanitizeTimer));
  let [notes, nextNoteId] = withUniqueIds(sanitizeList(parsed.notes, sanitizeNote));
  let [todos] = withUniqueIds(sanitizeList(parsed.todos, sanitizeTodo));
  // v3 -> v4 only adds the list, so older data simply has none yet.
  const [habits] = withUniqueIds(sanitizeList(parsed.habits, sanitizeHabit));

  if (version < 2) {
    // v1 -> v2: a timer used to show every day, so it becomes one independent
    // timer per weekday. Today's copy keeps the original id, progress and reps
    // (what the user sees right now doesn't change); the other days get fresh
    // copies, the same as the "Copy to days" action makes.
    timers = timers.flatMap((timer) =>
      DAYS.map((day) => (day === today ? { ...timer, day } : copyTimerTo(timer, day, nextTimerId())))
    );
  }

  if (version < 3) {
    // v2 -> v3: a note used to show every day. Like timers, it becomes one note
    // per weekday, so each day's view still lists exactly what it did before.
    // Today's copy keeps the original id. There were no todos yet.
    notes = notes.flatMap((note) =>
      DAYS.map((day) => (day === today ? { ...note, day } : { ...note, id: nextNoteId(), day }))
    );
    todos = [];
  }

  return {
    ...parsed,
    version: Math.max(version, STATE_VERSION),
    timers: onValidDay(timers, today),
    notes: onValidDay(notes, today),
    todos: onValidDay(todos, today),
    habits,
    // v4 -> v5 only adds the journal, so older data simply has no entries.
    journal: sanitizeJournal(parsed.journal),
    // v6 -> v7 only adds the list, so older data simply has none yet.
    milestones: withUniqueIds(sanitizeList(parsed.milestones, sanitizeMilestone))[0],
    embeds: Array.isArray(parsed.embeds) ? parsed.embeds : [],
  };
}

function persist(storageKey, state) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Storage full or unavailable: keep running on in-memory state.
  }
}

// Reads, validates and (once) migrates the persisted state. Never throws.
export function loadState(storageKey = import.meta.env.VITE_STORAGEKEY, today = getTodayKey()) {
  let raw;
  try {
    raw = window.localStorage.getItem(storageKey);
  } catch {
    return emptyState();
  }
  if (raw === null) return emptyState();

  let parsed = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // handled below
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    // Unreadable: set the raw text aside so the next save doesn't destroy it.
    try {
      window.localStorage.setItem(`${storageKey}.backup`, raw);
    } catch {
      // ignore
    }
    return emptyState();
  }

  const state = migrateState(parsed, today);
  // Write the migrated shape (with its version) straight away, so the
  // migration runs exactly once even if the user never changes anything.
  if (parsed.version !== state.version) persist(storageKey, state);
  return state;
}

// ---- Backup files -------------------------------------------------------
// A backup is the whole app state wrapped with a marker, so a random JSON file
// isn't mistaken for one. The privacy lock is not part of it: restoring a
// backup never changes the PIN.
export const BACKUP_FORMAT = 1;
export const BACKUP_MAX_BYTES = 20 * 1024 * 1024;

export class BackupError extends Error {}

export function backupFromState(state, now = new Date()) {
  return { app: "kaizen", format: BACKUP_FORMAT, exportedAt: now.toISOString(), data: state };
}

// Reads a backup file's text into app state, upgrading older backups the same
// way older saved data is upgraded. Throws BackupError with a message that can
// be shown as-is.
export function stateFromBackup(text, today = getTodayKey()) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BackupError("This file isn't a Kaizen backup (it couldn't be read).");
  }
  if (!isRecord(parsed) || parsed.app !== "kaizen" || !isRecord(parsed.data)) {
    throw new BackupError("This file isn't a Kaizen backup.");
  }
  if (parsed.format > BACKUP_FORMAT || parsed.data.version > STATE_VERSION) {
    throw new BackupError("This backup is from a newer version of Kaizen. Update the app and try again.");
  }
  return {
    state: migrateState(parsed.data, today),
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
  };
}

function reducer(state, action) {
  const { type, payload } = action;
  let updatedState;

  switch (type) {
    case "addTimer": {
      const timer = {
        id: idGenerator(state.timers)(),
        day: isDayKey(payload.day) ? payload.day : getTodayKey(),
        title: payload.title,
        seconds: payload.seconds,
        secondsSpent: payload.secondsSpent,
        initial: payload.seconds,
        reps: 0,
      };
      updatedState = { ...state, timers: [timer, ...state.timers] };
      break;
    }

    case "copyTimer": {
      const source = state.timers.find((timer) => timer.id === payload.id);
      if (!source) {
        updatedState = state;
        break;
      }
      // Days that already have an identical timer are skipped, not duplicated.
      const nextId = idGenerator(state.timers);
      const copies = DAYS.filter(
        (day) =>
          payload.days.includes(day) &&
          day !== source.day &&
          !hasIdenticalTimer(state.timers, source, day)
      ).map((day) => copyTimerTo(source, day, nextId()));
      updatedState = { ...state, timers: [...copies, ...state.timers] };
      break;
    }

    case "updateTimer": {
      updatedState = {
        ...state,
        timers: state.timers.map((timer) => {
          if (timer.id !== payload.id) return timer;
          return {
            ...timer,
            ...payload,
          };
        }),
      };
      break;
    }

    case "incrementReps": {
      updatedState = {
        ...state,
        timers: state.timers.map((timer) => {
          if (timer.id !== payload.id) return timer;
          return {
            ...timer,
            reps: timer.reps + 1,
          };
        }),
      };
      break;
    }

    case "resetReps": {
      updatedState = {
        ...state,
        timers: state.timers.map((timer) => {
          if (timer.id !== payload.id) return timer;
          return {
            ...timer,
            reps: 0,
          };
        }),
      };
      break;
    }

    case "deleteTimer": {
      updatedState = {
        ...state,
        timers: state.timers.filter((timer) => timer.id !== payload.id),
      };
      break;
    }

    case "addNote": {
      const note = {
        id: idGenerator(state.notes)(),
        day: isDayKey(payload.day) ? payload.day : getTodayKey(),
        content: payload.content,
      };
      updatedState = { ...state, notes: [note, ...state.notes] };
      break;
    }

    case "deleteNote": {
      updatedState = {
        ...state,
        notes: state.notes.filter(
          (note) => note.id !== payload.id
        ),
      };
      break;
    }

    case "addTodo": {
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text) {
        updatedState = state;
        break;
      }
      const todo = {
        id: idGenerator(state.todos)(),
        day: isDayKey(payload.day) ? payload.day : getTodayKey(),
        text,
        doneOn: null,
      };
      // Appended: a checklist reads top to bottom in the order it was written.
      updatedState = { ...state, todos: [...state.todos, todo] };
      break;
    }

    case "updateTodo": {
      // Blank text would leave an invisible item, so it keeps the old text.
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      updatedState = {
        ...state,
        todos: state.todos.map((todo) => {
          if (todo.id !== payload.id) return todo;
          return {
            ...todo,
            ...(text ? { text } : {}),
            ...("doneOn" in payload ? { doneOn: isDateKey(payload.doneOn) ? payload.doneOn : null } : {}),
          };
        }),
      };
      break;
    }

    case "copyTodo": {
      const source = state.todos.find((todo) => todo.id === payload.id);
      if (!source) {
        updatedState = state;
        break;
      }
      // Copies start not done; days that already have the same todo are skipped.
      const nextId = idGenerator(state.todos);
      const copies = DAYS.filter(
        (day) =>
          payload.days.includes(day) &&
          day !== source.day &&
          !hasIdenticalTodo(state.todos, source, day)
      ).map((day) => ({ ...source, id: nextId(), day, doneOn: null }));
      updatedState = { ...state, todos: [...state.todos, ...copies] };
      break;
    }

    case "deleteTodo": {
      updatedState = {
        ...state,
        todos: state.todos.filter((todo) => todo.id !== payload.id),
      };
      break;
    }

    case "addHabit": {
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      if (!name || !isHabitKind(payload.kind)) {
        updatedState = state;
        break;
      }
      const now = payload.now ?? Date.now();
      let habit = {
        id: idGenerator(state.habits)(),
        kind: payload.kind,
        name,
        createdOn: toDateKey(new Date(now)),
        ...(payload.kind === "daily" ? { target: toTarget(payload.target) } : { auto: null }),
        log: {},
      };
      if (payload.kind === "routine") habit = withAutoSettings(habit, toAutoSettings(payload.auto), now);
      updatedState = { ...state, habits: [...state.habits, habit] };
      break;
    }

    case "updateHabit": {
      // Blank names are ignored, like todos; the target only applies to daily.
      const name = typeof payload.name === "string" ? payload.name.trim() : "";
      updatedState = updateHabit(state, payload.id, (habit) => {
        const renamed = {
          ...habit,
          ...(name ? { name } : {}),
          ...(habit.kind === "daily" && payload.target != null ? { target: toTarget(payload.target) } : {}),
        };
        // `auto` left out = unchanged; null = turn off. Earlier auto taps are
        // saved first, so new settings never rewrite them.
        if (habit.kind !== "routine" || payload.auto === undefined) return renamed;
        return withAutoSettings(renamed, toAutoSettings(payload.auto), payload.now ?? Date.now());
      });
      break;
    }

    case "deleteHabit": {
      updatedState = { ...state, habits: state.habits.filter((habit) => habit.id !== payload.id) };
      break;
    }

    case "setDailyCount": {
      if (!isDateKey(payload.date)) {
        updatedState = state;
        break;
      }
      updatedState = updateHabit(state, payload.id, (habit) => {
        if (habit.kind !== "daily") return habit;
        const count = Math.min(toWhole(payload.count), habit.target);
        return withLogEntry(habit, payload.date, count || null);
      });
      break;
    }

    case "logRoutine": {
      // `delta` is +1 for a tap and -1 to undo one; a count never goes below 0.
      const field = payload.field;
      if (!isDateKey(payload.date) || (field !== "plus" && field !== "minus")) {
        updatedState = state;
        break;
      }
      // Each tap also saves when it happened (`plusAt`/`minusAt`), which the
      // auto-tap clock restarts from; undo removes the latest one.
      updatedState = updateHabit(state, payload.id, (habit) => {
        if (habit.kind !== "routine") return habit;
        const entry = { plus: 0, minus: 0, ...habit.log[payload.date] };
        const timesKey = `${field}At`;
        const times = [...(entry[timesKey] ?? [])];
        if (payload.delta < 0) {
          if (entry[field] > 0) times.pop();
          entry[field] = Math.max(0, entry[field] - 1);
        } else {
          entry[field] += 1;
          if (Number.isFinite(payload.at)) times.push(payload.at);
        }
        if (times.length) entry[timesKey] = times.slice(-MAX_TAP_TIMES);
        else delete entry[timesKey];
        return withLogEntry(habit, payload.date, isEmptyRoutineEntry(entry) ? null : entry);
      });
      break;
    }

    case "addMilestone": {
      const title = cleanText(payload.title, MILESTONE_TITLE_MAX);
      const achievedOn = isDateKey(payload.achievedOn) ? payload.achievedOn : null;
      if (!title || (!achievedOn && !isYear(payload.year))) {
        updatedState = state;
        break;
      }
      const milestone = {
        id: idGenerator(state.milestones)(),
        title,
        note: cleanText(payload.note, MILESTONE_NOTE_MAX),
        achievedOn,
        year: achievedOn ? Number(achievedOn.slice(0, 4)) : payload.year,
        kept: false,
      };
      updatedState = { ...state, milestones: [...state.milestones, milestone] };
      break;
    }

    case "updateMilestone": {
      // Title and note always; `achievedOn` when given (a date to mark it
      // reached or move it, null to make it a goal again).
      updatedState = {
        ...state,
        milestones: state.milestones.map((milestone) => {
          if (milestone.id !== payload.id) return milestone;
          const title = cleanText(payload.title ?? milestone.title, MILESTONE_TITLE_MAX) || milestone.title;
          const note = cleanText(payload.note ?? milestone.note, MILESTONE_NOTE_MAX);
          const achievedOn =
            "achievedOn" in payload ? (isDateKey(payload.achievedOn) ? payload.achievedOn : null) : milestone.achievedOn;
          const year = achievedOn ? Number(achievedOn.slice(0, 4)) : milestone.year;
          return { ...milestone, title, note, achievedOn, year, kept: achievedOn ? false : milestone.kept };
        }),
      };
      break;
    }

    case "deleteMilestone": {
      updatedState = { ...state, milestones: state.milestones.filter((m) => m.id !== payload.id) };
      break;
    }

    case "settleOldGoals": {
      // Unreached goals from years before `toYear`: carried into it, or kept
      // in their own year as "not reached".
      if (!isYear(payload.toYear)) {
        updatedState = state;
        break;
      }
      updatedState = {
        ...state,
        milestones: state.milestones.map((m) => {
          if (m.achievedOn || m.kept || m.year >= payload.toYear) return m;
          return payload.carry ? { ...m, year: payload.toYear } : { ...m, kept: true };
        }),
      };
      break;
    }

    case "setJournalEntry": {
      if (!isDateKey(payload.date)) {
        updatedState = state;
        break;
      }
      const text = typeof payload.text === "string" ? payload.text.slice(0, JOURNAL_MAX_LENGTH) : "";
      const journal = { ...state.journal };
      if (text.trim()) journal[payload.date] = text;
      else delete journal[payload.date];
      updatedState = { ...state, journal };
      break;
    }

    case "addEmbed": {
      updatedState = {
        ...state,
        embeds: [
          { id: new Date().getTime(), link: payload.link },
          ...(state.embeds || []),
        ],
      };
      break;
    }

    case "deleteEmbed": {
      updatedState = {
        ...state,
        embeds: (state.embeds || []).filter((embed) => embed.id !== payload.id),
      };
      break;
    }

    case "replaceAll": {
      updatedState = payload.state;
      break;
    }

    default: {
      updatedState = state;
    }
  }

  persist(import.meta.env.VITE_STORAGEKEY, updatedState);

  return updatedState;
}

const store = createContext(emptyState());
const { Provider } = store;

function StoreProvider({ children }) {
  // Loaded on mount (not at import time) so the migration and corrupt-data
  // handling run against what's in storage when the app actually starts.
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState());
  // Bumped when everything is replaced (restoring a backup), so the page can
  // rebuild and drop any copies sections keep while editing.
  const [generation, setGeneration] = useState(0);

  const addTimer = (title, seconds, secondsSpent = 0, play = false, day = getTodayKey()) => {
    dispatch({
      type: "addTimer",
      payload: {
        title,
        seconds,
        secondsSpent,
        play,
        day,
      },
    });
  };

  const copyTimer = (id, days) => {
    dispatch({
      type: "copyTimer",
      payload: { id, days },
    });
  };

  const deleteTimer = (id) => {
    dispatch({
      type: "deleteTimer",
      payload: { id },
    });
  };

  const updateSecondsSpent = (id, secondsSpent) => {
    dispatch({
      type: "updateTimer",
      payload: {
        id,
        secondsSpent,
      },
    });
  };

  const incrementReps = (id) => {
    dispatch({
      type: "incrementReps",
      payload: { id },
    });
  };

  const resetReps = (id) => {
    dispatch({
      type: "resetReps",
      payload: { id },
    });
  };

  const addNote = (content, day = getTodayKey()) => {
    dispatch({
      type: "addNote",
      payload: {
        content,
        day,
      },
    });
  };

  const addTodo = (text, day = getTodayKey()) => {
    dispatch({ type: "addTodo", payload: { text, day } });
  };

  // `doneOn` is the date the todo is ticked for (see isTodoDone), or null.
  const setTodoDone = (id, doneOn) => {
    dispatch({ type: "updateTodo", payload: { id, doneOn } });
  };

  const renameTodo = (id, text) => {
    dispatch({ type: "updateTodo", payload: { id, text } });
  };

  const copyTodo = (id, days) => {
    dispatch({ type: "copyTodo", payload: { id, days } });
  };

  const deleteTodo = (id) => {
    dispatch({ type: "deleteTodo", payload: { id } });
  };

  const deleteNote = (id) => {
    dispatch({
      type: "deleteNote",
      payload: { id },
    });
  };

  // `auto` (routines only): { direction, everyMinutes, maxPerDay }, or null
  // for off. Left out when editing = keep the current setting.
  const addHabit = (kind, name, target, auto = null) => {
    dispatch({ type: "addHabit", payload: { kind, name, target, auto, now: Date.now() } });
  };

  const editHabit = (id, name, target, auto) => {
    dispatch({ type: "updateHabit", payload: { id, name, target, auto, now: Date.now() } });
  };

  const deleteHabit = (id) => {
    dispatch({ type: "deleteHabit", payload: { id } });
  };

  // Slots filled on `date` ("YYYY-MM-DD") for a daily habit.
  const setDailyCount = (id, date, count) => {
    dispatch({ type: "setDailyCount", payload: { id, date, count } });
  };

  // One + or - tap on a routine, logged on `date` (today by default).
  const logRoutine = (id, field, delta = 1, date = toDateKey()) => {
    dispatch({ type: "logRoutine", payload: { id, field, delta, date, at: Date.now() } });
  };

  // `achievedOn` (a date) for a milestone already reached, or `year` for a goal.
  const addMilestone = ({ title, note = "", achievedOn = null, year = null }) => {
    dispatch({ type: "addMilestone", payload: { title, note, achievedOn, year } });
  };

  const updateMilestone = (id, changes) => {
    dispatch({ type: "updateMilestone", payload: { id, ...changes } });
  };

  const deleteMilestone = (id) => {
    dispatch({ type: "deleteMilestone", payload: { id } });
  };

  // Unreached goals from before `toYear`: carry (true) or keep where they are.
  const settleOldGoals = (toYear, carry) => {
    dispatch({ type: "settleOldGoals", payload: { toYear, carry } });
  };

  // Clearing the text removes the entry.
  const setJournalEntry = (date, text) => {
    dispatch({ type: "setJournalEntry", payload: { date, text } });
  };

  // Restoring a backup: everything is replaced at once.
  const replaceAll = (next) => {
    dispatch({ type: "replaceAll", payload: { state: next } });
    setGeneration((n) => n + 1);
  };

  const addEmbed = (link) => {
    dispatch({
      type: "addEmbed",
      payload: {
        link,
      },
    });
  };

  const deleteEmbed = (id) => {
    dispatch({
      type: "deleteEmbed",
      payload: { id },
    });
  };

  return (
    <Provider
      value={{
        timers: state.timers,
        addTimer,
        copyTimer,
        deleteTimer,
        updateSecondsSpent,
        notes: state.notes,
        addNote,
        deleteNote,
        todos: state.todos,
        addTodo,
        setTodoDone,
        renameTodo,
        copyTodo,
        deleteTodo,
        habits: state.habits,
        addHabit,
        editHabit,
        deleteHabit,
        setDailyCount,
        logRoutine,
        journal: state.journal,
        milestones: state.milestones,
        addMilestone,
        updateMilestone,
        deleteMilestone,
        settleOldGoals,
        fullState: state,
        generation,
        replaceAll,
        setJournalEntry,
        embeds: state.embeds,
        addEmbed,
        deleteEmbed,
        incrementReps,
        resetReps
      }}
    >
      {children}
    </Provider>
  );
}

export { store, StoreProvider };
