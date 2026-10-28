import { RETIRE_AFTER_MS, syncOnce } from './cycle';
import { applyChanges, emptyMeta, hasData, materialize, merge, recordLocal } from './engine';
import { normalizeState, STATE_VERSION } from '../redux/store';

// An in-memory Google Drive app folder.
function fakeDrive() {
  const files = new Map();
  let nextId = 1;
  let clock = 0;
  const drive = {
    files,
    hook: null, // runs before an update lands, to simulate another device
    async findSyncFiles() {
      return [...files.entries()].map(([id, f]) => ({ id, name: f.name, createdTime: f.created, modifiedTime: f.modified }));
    },
    async downloadSyncFile(_token, id) {
      return JSON.parse(files.get(id).content);
    },
    async createSyncFile(_token, name, content) {
      const id = `f${nextId++}`;
      const at = new Date(Date.UTC(2026, 9, 1) + clock++).toISOString();
      files.set(id, { name, content: JSON.stringify(content), created: at, modified: new Date().toISOString() });
      return { id };
    },
    async updateSyncFile(_token, id, content) {
      if (drive.hook) {
        const hook = drive.hook;
        drive.hook = null;
        await hook();
      }
      const file = files.get(id);
      if (!file) throw Object.assign(new Error('not found'), { status: 404 });
      file.content = JSON.stringify(content);
      file.modified = new Date().toISOString();
      return { id };
    },
    async deleteSyncFile(_token, id) {
      files.delete(id);
    },
  };
  return drive;
}

const normalize = (s) => normalizeState(s, 'wed');
const timer = (fields) => ({ id: 1, day: 'wed', title: 'Deep work', seconds: 1500, secondsSpent: 0, initial: 1500, reps: 0, repsOn: {}, pomodoro: null, ...fields });

// A device: app state + sync copy, committed the way the app does it.
function device(id, initial = {}) {
  let state = normalize(initial);
  let meta = emptyMeta(id);
  const kept = [];
  const local = {
    meta: () => (meta = recordLocal(meta, state).meta),
    hasData: () => hasData(state),
    commit: (merged, { base, joined }) => {
      const after = recordLocal(base, state).meta;
      meta = joined ? applyChanges(merged, base, after) : { ...merge(after, merged), epoch: merged.epoch };
      state = normalize(materialize(meta));
    },
    keepCopy: () => {
      kept.push(state);
      return true;
    },
  };
  return {
    local,
    kept,
    get state() {
      return state;
    },
    edit(change) {
      state = normalize(change(state));
    },
    wipe() {
      state = normalize({});
    },
    sync(drive, join) {
      return syncOnce({ token: 't', drive, local, stateVersion: STATE_VERSION, join });
    },
  };
}

test('each device writes its own file; a new empty device just takes the data', async () => {
  const drive = fakeDrive();
  const a = device('A', { timers: [timer()] });
  expect(await a.sync(drive)).toEqual({ status: 'synced' });
  expect([...drive.files.values()].map((f) => f.name)).toEqual(['kaizen-sync-A.json']);

  const b = device('B');
  expect(await b.sync(drive)).toEqual({ status: 'synced' });
  expect(b.state.timers.map((t) => t.title)).toEqual(['Deep work']);
  expect([...drive.files.values()].map((f) => f.name).sort()).toEqual(['kaizen-sync-A.json', 'kaizen-sync-B.json']);
});

test('a device with its own data asks first, keeps a copy, then uses Drive\'s or combines', async () => {
  const drive = fakeDrive();
  await device('A', { timers: [timer({ reps: 5, repsOn: { '2026-10-27': 5 } })] }).sync(drive);

  const b = device('B', { journal: { '2026-10-28': 'Mine' } });
  expect(await b.sync(drive)).toEqual({ status: 'needs-choice' });
  expect(b.state.journal).toEqual({ '2026-10-28': 'Mine' });

  await b.sync(drive, 'drive');
  expect(b.state.journal).toEqual({});
  expect(b.state.timers).toHaveLength(1);
  expect(b.kept[0].journal).toEqual({ '2026-10-28': 'Mine' });

  // Same timer on both (from the same backup): combine keeps the larger count.
  const c = device('C', { timers: [timer({ reps: 3, repsOn: { '2026-10-27': 3 } })], journal: { '2026-10-27': 'Also mine' } });
  await c.sync(drive, 'combine');
  expect(c.kept).toHaveLength(1);
  expect(c.state.journal).toEqual({ '2026-10-27': 'Also mine' });
  expect(c.state.timers[0]).toMatchObject({ reps: 5, repsOn: { '2026-10-27': 5 } });
});

test('two devices finishing rounds offline end up with both counted', async () => {
  const drive = fakeDrive();
  const a = device('A', { timers: [timer()] });
  await a.sync(drive);
  const b = device('B');
  await b.sync(drive);

  const finish = (s) => ({ ...s, timers: [{ ...s.timers[0], reps: s.timers[0].reps + 1, repsOn: { '2026-10-28': (s.timers[0].repsOn['2026-10-28'] ?? 0) + 1 } }] });
  a.edit(finish);
  b.edit(finish);
  b.edit(finish);
  await a.sync(drive);
  await b.sync(drive);
  await a.sync(drive);

  expect(a.state.timers[0]).toMatchObject({ reps: 3, repsOn: { '2026-10-28': 3 } });
  expect(b.state).toEqual(a.state);
});

test('another device saving in the middle of a sync loses nothing, even on Drive', async () => {
  const drive = fakeDrive();
  const a = device('A', { journal: { '2026-10-26': 'a' } });
  await a.sync(drive);
  const b = device('B');
  await b.sync(drive);

  a.edit((s) => ({ ...s, journal: { ...s.journal, '2026-10-27': 'from A' } }));
  b.edit((s) => ({ ...s, journal: { ...s.journal, '2026-10-28': 'from B' } }));
  drive.hook = () => b.sync(drive);
  await a.sync(drive);

  // B's change is on Drive right away (its own file), and a third device sees both.
  const c = device('C');
  await c.sync(drive);
  expect(c.state.journal).toEqual({ '2026-10-26': 'a', '2026-10-27': 'from A', '2026-10-28': 'from B' });
});

test('a device whose data was wiped gets it back from its own file', async () => {
  const drive = fakeDrive();
  const a = device('A', { journal: { '2026-10-26': 'a', '2026-10-27': 'b' } });
  await a.sync(drive);
  // The app's data is gone; the sync copy starts over (see SyncProvider).
  a.wipe();
  a.local.meta = (() => {
    let meta = { ...emptyMeta('A') };
    return () => (meta = recordLocal(meta, a.state).meta);
  })();
  const fresh = device('A');
  await fresh.sync(drive);
  expect(fresh.state.journal).toEqual({ '2026-10-26': 'a', '2026-10-27': 'b' });
});

test('files of devices silent for two months are folded in and removed (never the oldest)', async () => {
  const drive = fakeDrive();
  await device('FIRST', { journal: { '2026-10-20': 'first' } }).sync(drive);
  const old = device('OLD');
  await old.sync(drive);
  old.edit((s) => ({ ...s, journal: { ...s.journal, '2026-01-01': 'old phone' } }));
  await old.sync(drive);
  const [first, oldFile] = [...drive.files.values()];
  oldFile.modified = new Date(Date.parse(first.modified) - RETIRE_AFTER_MS - 1000).toISOString();

  const a = device('A');
  await a.sync(drive);
  expect([...drive.files.values()].map((f) => f.name).sort()).toEqual(['kaizen-sync-A.json', 'kaizen-sync-FIRST.json']);
  const c = device('C');
  await c.sync(drive);
  expect(c.state.journal).toEqual({ '2026-01-01': 'old phone', '2026-10-20': 'first' });
});

test('two devices set up at the same moment: the later one isn\'t merged in until it chooses', async () => {
  const drive = fakeDrive();
  const backup = { timers: [timer({ reps: 5, repsOn: { '2026-10-27': 5 } })] };
  const a = device('A', backup);
  const b = device('B', { ...backup, journal: { '2026-10-28': 'B only' } });
  // Both see an empty Drive and create their own generation.
  const find = drive.findSyncFiles;
  drive.findSyncFiles = async () => [];
  await a.sync(drive);
  await b.sync(drive);
  drive.findSyncFiles = find;

  await a.sync(drive);
  expect(a.state.timers[0].reps).toBe(5);
  expect(a.state.journal).toEqual({});

  expect(await b.sync(drive)).toEqual({ status: 'needs-choice' });
  await b.sync(drive, 'combine');
  expect(b.state.timers[0].reps).toBe(5);
  expect(b.state.journal).toEqual({ '2026-10-28': 'B only' });
  await a.sync(drive);
  expect(a.state.timers[0].reps).toBe(5);
  expect(a.state.journal).toEqual({ '2026-10-28': 'B only' });
});

test('combine adds up focus time (it isn\'t tied to a shared record)', async () => {
  const drive = fakeDrive();
  const focus = (seconds) => ({ '2026-10-28': { 'deep work': { title: 'Deep work', seconds, rounds: 1 } } });
  await device('A', { focus: focus(3000) }).sync(drive);
  const b = device('B', { focus: focus(1500) });
  await b.sync(drive, 'combine');
  expect(b.state.focus['2026-10-28']['deep work']).toMatchObject({ seconds: 4500, rounds: 2 });
});

test('a change made while joining is kept', async () => {
  const drive = fakeDrive();
  await device('A', { journal: { '2026-10-26': 'from A' } }).sync(drive);
  const b = device('B', { journal: { '2026-10-27': 'from B' } });
  // B writes something while its "use Drive's data" sync is on its way.
  const download = drive.downloadSyncFile;
  drive.downloadSyncFile = async (...args) => {
    b.edit((s) => ({ ...s, journal: { ...s.journal, '2026-10-28': 'typed meanwhile' } }));
    drive.downloadSyncFile = download;
    return download(...args);
  };
  await b.sync(drive, 'drive');
  expect(b.state.journal).toEqual({ '2026-10-26': 'from A', '2026-10-28': 'typed meanwhile' });
});

test('a missing own file is created again', async () => {
  const drive = fakeDrive();
  const a = device('A', { journal: { '2026-10-26': 'a' } });
  await a.sync(drive);
  const ownId = [...drive.files.keys()][0];
  // Listed, but gone by the time we write (deleted in between).
  drive.hook = async () => drive.files.delete(ownId);
  await a.sync(drive);
  expect([...drive.files.values()].map((f) => f.name)).toEqual(['kaizen-sync-A.json']);
});

test('data from a newer Kaizen is left alone until this device updates', async () => {
  const drive = fakeDrive();
  await drive.createSyncFile('t', 'kaizen-sync-X.json', { app: 'kaizen-sync', format: 1, stateVersion: STATE_VERSION + 1, epoch: 'e', cells: {}, records: {}, deleted: {} });
  const a = device('A', { journal: { '2026-10-28': 'x' } });
  expect(await a.sync(drive)).toEqual({ status: 'update-app' });
  expect(drive.files.size).toBe(1);
});
