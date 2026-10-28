// The sync engine: pure functions, no network, no React.
//
// Each device keeps a "sync copy" (meta) next to the app state. It holds
// every value in the state as a small cell with merge information:
//
//   - most values ("lww"): the value plus when it was last changed (a hybrid
//     logical clock stamp, see `tick`). When two devices changed the same
//     value, the later change wins. Values are fine-grained (a timer's title
//     and its length are separate cells), so different edits don't clash.
//   - counts ("counter"): how much each device added and took away. Merging
//     keeps every device's own contribution, so a round finished on the phone
//     and one on the laptop add up to 2 instead of one overwriting the other.
//     A count never shows below 0 (see FLOOR).
//   - tap times ("set"): which times were added and which removed (undo).
//   - records (a timer, a todo...): when each was created, which also sets
//     their order on every device. Deleted records stay deleted: the
//     tombstone wins over anything else, and their cells are dropped.
//   - "device" values (a running round's progress) stay on their device.
//
// Local changes are found by comparing the app state with the sync copy
// (`recordLocal`), so the store doesn't need to know about sync at all. Two
// copies are merged with `merge`, which is commutative, associative and
// idempotent: devices end up with the same data whatever order they sync in,
// and syncing the same thing twice changes nothing.

const RECORD_LISTS = ["timers", "notes", "todos", "habits", "milestones", "embeds"];
// New records go first in these lists (see the store's add actions), and last
// in the others.
const NEWEST_FIRST = new Set(["timers", "notes", "embeds"]);
const MAPS = ["journal", "focus"];

const COUNTERS = [
  ["timers", "*", "reps"],
  ["timers", "*", "repsOn", "*"],
  ["habits", "*", "log", "*", "plus"],
  ["habits", "*", "log", "*", "minus"],
  ["focus", "*", "*", "seconds"],
  ["focus", "*", "*", "rounds"],
];
const SETS = [
  ["habits", "*", "log", "*", "plusAt"],
  ["habits", "*", "log", "*", "minusAt"],
];
// Stored as one value rather than field by field.
const WHOLE = [
  ["timers", "*", "pomodoro"],
  ["habits", "*", "auto"],
];
// The current round's progress belongs to the device running it: it changes
// every minute while a timer runs, and the focus log already shares the time.
const DEVICE_ONLY = [["timers", "*", "secondsSpent"]];

// Two devices can take away the same thing at once (both undo the same tap):
// that would push a count below 0. Rather than each device "fixing" it with
// its own +1 (which adds up), every device works out the same correction and
// files it under this shared name, merged by maximum like any device.
// Known limit, accepted as rare: counts don't know which tap is which, so if
// two devices undo the same tap while a third adds one, that new tap can be
// absorbed. Likewise, renaming the same timer differently on two devices at
// once copies its focus history to both names.
const FLOOR = "~floor";

// Tap times are capped like the store does (see MAX_TAP_TIMES there).
const MAX_SET = 200;

const matches = (path, pattern) =>
  path.length === pattern.length && pattern.every((part, i) => part === "*" || part === path[i]);
const matchesAny = (path, patterns) => patterns.some((pattern) => matches(path, pattern));

export function kindOf(path) {
  if (matchesAny(path, COUNTERS)) return "counter";
  if (matchesAny(path, SETS)) return "set";
  if (matchesAny(path, DEVICE_ONLY)) return "device";
  return "lww";
}

const keyOf = (path) => JSON.stringify(path);
const pathOf = (key) => JSON.parse(key);
const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);

// "timers/123/title" belongs to record "timers/123".
const recordKeyOf = (path) => (RECORD_LISTS.includes(path[0]) && path.length > 1 ? keyOf(path.slice(0, 2)) : null);

// ---- Clock ----

// Hybrid logical clock: wall time, a counter for several changes in the same
// millisecond (or a clock that went backwards), and the device id as the final
// tie-break. Stamps compare as plain strings.
export function tick(clock, deviceId, now = Date.now()) {
  const ms = Math.max(now, clock.ms);
  const c = ms === clock.ms ? clock.c + 1 : 0;
  return { clock: { ms, c }, stamp: `${String(ms).padStart(15, "0")}:${String(c).padStart(6, "0")}:${deviceId}` };
}

const stampTime = (stamp) => {
  const [ms, c] = stamp.split(":");
  return { ms: Number(ms), c: Number(c) };
};

const laterClock = (a, b) => (a.ms > b.ms || (a.ms === b.ms && a.c >= b.c) ? a : b);

// ---- Flattening the app state into cells ----

function walk(path, value, leaves) {
  if (value === undefined || value === null) return;
  if (isPlainObject(value) && !matchesAny(path, WHOLE)) {
    for (const [key, inner] of Object.entries(value)) walk([...path, key], inner, leaves);
    return;
  }
  leaves.set(keyOf(path), value);
}

// Every value in the state by path, and the records in list order.
export function flatten(state) {
  const leaves = new Map();
  const records = new Map(); // list -> ids in order
  for (const list of RECORD_LISTS) {
    const ids = [];
    for (const record of Array.isArray(state[list]) ? state[list] : []) {
      if (!isPlainObject(record) || !Number.isFinite(record.id)) continue;
      ids.push(record.id);
      for (const [field, value] of Object.entries(record)) {
        if (field !== "id") walk([list, record.id, field], value, leaves);
      }
    }
    records.set(list, ids);
  }
  for (const map of MAPS) walk([map], state[map], leaves);
  return { leaves, records };
}

// ---- Cells ----

const sum = (side = {}) => Object.values(side).reduce((total, n) => total + n, 0);
const counterValue = (cell) => sum(cell?.p) - sum(cell?.n);

const setValue = (cell) => {
  const removed = new Set(cell?.r ?? []);
  return (cell?.s ?? []).filter((value) => !removed.has(value));
};
const sortedUnique = (values) => [...new Set(values)].sort((a, b) => a - b);
// Keeps the newest times, which are the ones that matter (auto taps restart
// from the latest tap).
const capped = (values) => sortedUnique(values).slice(-MAX_SET);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function emptyMeta(deviceId) {
  return { deviceId, epoch: null, clock: { ms: 0, c: 0 }, cells: {}, records: {}, deleted: {} };
}

// Brings the sync copy up to date with the app state: anything that differs
// is a local change and gets this device's stamp (or counts as this device's
// contribution). Returns the new meta, whether it changed, and whether the
// change is one to share.
export function recordLocal(meta, state, now = Date.now()) {
  const { leaves, records } = flatten(state);
  const device = meta.deviceId;
  const cells = { ...meta.cells };
  const recordsMeta = { ...meta.records };
  const deleted = { ...meta.deleted };
  let clock = meta.clock;
  let batch = null;
  const stampNow = () => {
    if (!batch) ({ clock, stamp: batch } = tick(clock, device, now));
    return batch;
  };
  // New records each get their own stamp, in list order, so the order they
  // have here is the order every device shows.
  const newRecordStamp = () => {
    const next = tick(clock, device, now);
    clock = next.clock;
    return next.stamp;
  };

  const present = new Set();
  for (const [list, ids] of records) {
    const inOrder = NEWEST_FIRST.has(list) ? [...ids].reverse() : ids;
    for (const id of inOrder) {
      const record = keyOf([list, id]);
      present.add(record);
      // A deleted record stays deleted (see withFreshIds in the store for
      // restoring one).
      if (!recordsMeta[record] && !deleted[record]) recordsMeta[record] = newRecordStamp();
    }
  }
  for (const record of Object.keys(recordsMeta)) {
    if (present.has(record)) continue;
    deleted[record] = stampNow();
    delete recordsMeta[record];
  }

  const update = (key, value) => {
    const path = pathOf(key);
    const kind = kindOf(path);
    const cell = cells[key];
    if (kind === "counter") {
      const delta = (Number(value) || 0) - counterValue(cell);
      if (!delta) return;
      const side = delta > 0 ? "p" : "n";
      const next = { p: { ...(cell?.p ?? {}) }, n: { ...(cell?.n ?? {}) } };
      next[side][device] = (next[side][device] ?? 0) + Math.abs(delta);
      cells[key] = next;
    } else if (kind === "set") {
      const mine = new Set(Array.isArray(value) ? value : []);
      const current = setValue(cell);
      const added = [...mine].filter((v) => !current.includes(v));
      const removed = current.filter((v) => !mine.has(v));
      if (!added.length && !removed.length) return;
      cells[key] = { s: capped([...(cell?.s ?? []), ...added]), r: capped([...(cell?.r ?? []), ...removed]) };
    } else if (!cell || !same(cell.v, value)) {
      cells[key] = { t: stampNow(), v: value };
    }
  };

  for (const [key, value] of leaves) {
    const record = recordKeyOf(pathOf(key));
    if (record && deleted[record]) continue;
    update(key, value);
  }
  for (const key of Object.keys(cells)) {
    if (leaves.has(key)) continue;
    const record = recordKeyOf(pathOf(key));
    if (record && deleted[record]) {
      delete cells[key];
      continue;
    }
    // Gone from the state: a count back to 0, a value cleared, tap times gone.
    const kind = kindOf(pathOf(key));
    if (kind === "counter" || kind === "set") update(key, kind === "counter" ? 0 : []);
    else if (cells[key].v !== undefined) cells[key] = { t: stampNow(), v: undefined };
  }

  // `changed`: the meta needs saving. `shared`: something other devices
  // should get, so it's worth a sync (device-only values don't count).
  const touched = [...new Set([...Object.keys(cells), ...Object.keys(meta.cells)])].filter(
    (key) => cells[key] !== meta.cells[key]
  );
  const shared =
    !same(deleted, meta.deleted) ||
    !same(recordsMeta, meta.records) ||
    touched.some((key) => kindOf(pathOf(key)) !== "device");
  const changed = shared || touched.length > 0;

  return { meta: { ...meta, clock, cells, records: recordsMeta, deleted }, changed, shared };
}

// ---- Merging ----

function mergeSide(x = {}, y = {}) {
  const out = { ...x };
  for (const [device, n] of Object.entries(y)) out[device] = Math.max(out[device] ?? 0, n);
  return out;
}

function mergeCell(kind, a, b) {
  if (kind === "counter") {
    const p = mergeSide(a?.p, b?.p);
    const n = mergeSide(a?.n, b?.n);
    // Below 0 without the floor: raise the shared floor just enough.
    const { [FLOOR]: floor = 0, ...devices } = p;
    const need = sum(n) - sum(devices);
    if (need > floor) p[FLOOR] = need;
    return { p, n };
  }
  if (!a) return b;
  if (!b) return a;
  if (kind === "set") return { s: capped([...(a.s ?? []), ...(b.s ?? [])]), r: capped([...(a.r ?? []), ...(b.r ?? [])]) };
  if (a.t !== b.t) return a.t > b.t ? a : b;
  // Same stamp means same change; compare values only to stay deterministic.
  return JSON.stringify(a.v ?? null) >= JSON.stringify(b.v ?? null) ? a : b;
}

// Merges another copy (`other`, from Drive) into this device's meta.
// Device-only values stay as they are here.
export function merge(meta, other) {
  const deleted = { ...meta.deleted };
  for (const [record, stamp] of Object.entries(other.deleted ?? {})) {
    if (!deleted[record] || stamp > deleted[record]) deleted[record] = stamp;
  }

  const records = {};
  for (const source of [meta.records, other.records ?? {}]) {
    for (const [record, stamp] of Object.entries(source)) {
      if (deleted[record]) continue;
      if (!records[record] || stamp < records[record]) records[record] = stamp;
    }
  }

  const cells = {};
  const keys = new Set([...Object.keys(meta.cells), ...Object.keys(other.cells ?? {})]);
  for (const key of keys) {
    const path = pathOf(key);
    const record = recordKeyOf(path);
    if (record && deleted[record]) continue;
    const kind = kindOf(path);
    const cell = kind === "device" ? meta.cells[key] ?? other.cells?.[key] : mergeCell(kind, meta.cells[key], other.cells?.[key]);
    if (cell) cells[key] = cell;
  }

  let clock = meta.clock;
  for (const stamp of [...Object.values(cells).map((cell) => cell.t), ...Object.values(deleted), ...Object.values(records)]) {
    if (stamp) clock = laterClock(clock, stampTime(stamp));
  }

  return { ...meta, clock, cells, records, deleted };
}

// Joining Drive with "combine both": the same record on both sides (same
// id, so both came from the same backup) keeps the larger count instead of
// adding them up. Focus time isn't tied to a record (it's by activity name),
// so it adds up. Applied to this device's meta before merging.
export function preferLarger(meta, other) {
  const cells = { ...meta.cells };
  const device = meta.deviceId;
  for (const [key, mine] of Object.entries(meta.cells)) {
    const theirs = other.cells?.[key];
    const path = pathOf(key);
    const record = recordKeyOf(path);
    if (!theirs || kindOf(path) !== "counter" || !record || !other.records?.[record]) continue;
    const local = counterValue(mine);
    const remote = counterValue(theirs);
    const own = (mine.p?.[device] ?? 0) - (mine.n?.[device] ?? 0);
    const others = local - own;
    const target = Math.max(local, remote) - remote - others;
    cells[key] = {
      p: { ...mine.p, [device]: Math.max(target, 0) },
      n: { ...mine.n, [device]: Math.max(-target, 0) },
    };
  }
  return { ...meta, cells };
}

// What changed on this device between `base` and `after` (both its own
// copies), laid on top of `target`: new values, this device's added counts,
// tap times, new and deleted records. Used when the merged copy isn't built
// on `base` (joining Drive), so changes made during that sync still count.
export function applyChanges(target, base, after) {
  const device = after.deviceId;
  const cells = { ...target.cells };
  const records = { ...target.records };
  const deleted = { ...target.deleted };
  for (const [record, stamp] of Object.entries(after.deleted)) {
    if (base.deleted[record]) continue;
    deleted[record] = stamp;
    delete records[record];
  }
  for (const [record, stamp] of Object.entries(after.records)) {
    if (!base.records[record] && !deleted[record]) records[record] = stamp;
  }
  for (const [key, cell] of Object.entries(after.cells)) {
    const before = base.cells[key];
    if (cell === before) continue;
    const path = pathOf(key);
    const record = recordKeyOf(path);
    if (record && deleted[record]) continue;
    const kind = kindOf(path);
    if (kind === "counter") {
      const grew = (side) => (cell[side]?.[device] ?? 0) - (before?.[side]?.[device] ?? 0);
      const into = cells[key] ?? { p: {}, n: {} };
      cells[key] = {
        p: { ...into.p, [device]: (into.p?.[device] ?? 0) + grew("p") },
        n: { ...into.n, [device]: (into.n?.[device] ?? 0) + grew("n") },
      };
    } else if (kind === "device") {
      cells[key] = cell;
    } else {
      cells[key] = mergeCell(kind, cells[key], cell);
    }
  }
  let clock = target.clock;
  if (after.clock) clock = laterClock(clock, after.clock);
  return { ...target, clock, cells, records, deleted };
}

// ---- Back to app state ----

function setIn(target, path, value) {
  let node = target;
  for (let i = 0; i < path.length - 1; i++) {
    if (!isPlainObject(node[path[i]])) node[path[i]] = {};
    node = node[path[i]];
  }
  node[path[path.length - 1]] = value;
}

// The app state described by a meta. The store still runs its usual clean-up
// over it (the caller does), which fills in defaults and drops empty entries.
export function materialize(meta) {
  const byRecord = new Map();
  const maps = {};
  for (const [key, cell] of Object.entries(meta.cells)) {
    const path = pathOf(key);
    const kind = kindOf(path);
    const value = kind === "counter" ? Math.max(0, counterValue(cell)) : kind === "set" ? setValue(cell) : cell.v;
    if (value === undefined) continue;
    const record = recordKeyOf(path);
    if (record) {
      if (!meta.records[record]) continue;
      if (!byRecord.has(record)) byRecord.set(record, { id: path[1] });
      setIn(byRecord.get(record), path.slice(2), value);
    } else if (MAPS.includes(path[0])) {
      setIn(maps, path, value);
    }
  }

  const state = {};
  for (const list of RECORD_LISTS) {
    const entries = Object.entries(meta.records)
      .map(([record, stamp]) => [pathOf(record), stamp])
      .filter(([[name]]) => name === list)
      .sort(([[, a], sa], [[, b], sb]) => (sa < sb ? -1 : sa > sb ? 1 : a - b));
    if (NEWEST_FIRST.has(list)) entries.reverse();
    state[list] = entries.map(([[, id]]) => byRecord.get(keyOf([list, id])) ?? { id });
  }
  for (const map of MAPS) state[map] = maps[map] ?? {};
  return state;
}

// What goes to Drive: everything except device-only values.
export function toShared(meta) {
  const cells = {};
  for (const [key, cell] of Object.entries(meta.cells)) {
    if (kindOf(pathOf(key)) !== "device") cells[key] = cell;
  }
  return { cells, records: meta.records, deleted: meta.deleted };
}

// How many things (records, journal days, focus entries) a state holds.
export function itemCount(state) {
  const { leaves, records } = flatten(state);
  let count = 0;
  for (const ids of records.values()) count += ids.length;
  const entries = new Set();
  for (const key of leaves.keys()) {
    const path = pathOf(key);
    if (path[0] === "journal") entries.add(keyOf(path.slice(0, 2)));
    if (path[0] === "focus") entries.add(keyOf(path.slice(0, 3)));
  }
  return count + entries.size;
}

export const hasData = (state) => itemCount(state) > 0;
