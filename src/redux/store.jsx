import { createContext, useReducer } from "react";
import { DAYS, getTodayKey, isDayKey } from "../utilities/day-helper";

// Bump when the persisted shape changes, and add a step to migrateState().
// 1 (implicit, no `version` field): timers had no `day`.
// 2: every timer belongs to exactly one weekday via `day`.
export const STATE_VERSION = 2;

const emptyState = () => ({ version: STATE_VERSION, timers: [], notes: [], embeds: [] });

// Timer ids used to be plain Date.now() values, which collide when several
// timers are created in one action (copies, migration). Keep them numeric and
// time-based, but strictly increasing past every id already in use.
function idGenerator(timers) {
  let last = timers.reduce((max, timer) => Math.max(max, timer.id), 0);
  return () => {
    last = Math.max(Date.now(), last + 1);
    return last;
  };
}

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

// Coerces one persisted timer into a usable shape, or drops it (null) if it
// isn't even an object. Ids are de-duplicated by the caller.
function sanitizeTimer(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
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

function migrateState(parsed, today) {
  const version = Number.isFinite(parsed.version) ? parsed.version : 1;
  let timers = (Array.isArray(parsed.timers) ? parsed.timers : [])
    .map(sanitizeTimer)
    .filter(Boolean);

  // Every timer needs a unique numeric id before copies are made from it.
  const nextId = idGenerator(timers.filter((timer) => Number.isFinite(timer.id)));
  const seen = new Set();
  timers = timers.map((timer) => {
    const id = Number.isFinite(timer.id) && !seen.has(timer.id) ? timer.id : nextId();
    seen.add(id);
    return { ...timer, id };
  });

  if (version < 2) {
    // v1 -> v2: a timer used to show every day, so it becomes one independent
    // timer per weekday. Today's copy keeps the original id, progress and reps
    // (what the user sees right now doesn't change); the other days get fresh
    // copies, the same as the "Copy to days" action makes.
    timers = timers.flatMap((timer) =>
      DAYS.map((day) => (day === today ? { ...timer, day } : copyTimerTo(timer, day, nextId())))
    );
  }

  // Current-version data with a missing/invalid day (hand-edited, partially
  // written) shows up today rather than vanishing.
  timers = timers.map((timer) => (isDayKey(timer.day) ? timer : { ...timer, day: today }));

  return {
    ...parsed,
    version: Math.max(version, STATE_VERSION),
    timers,
    notes: Array.isArray(parsed.notes) ? parsed.notes : [],
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
        id: new Date().getTime(),
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

  const addNote = (content) => {
    dispatch({
      type: "addNote",
      payload: {
        content,
      },
    });
  };

  const deleteNote = (id) => {
    dispatch({
      type: "deleteNote",
      payload: { id },
    });
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
