import { emptyMeta, flatten, hasData, kindOf, materialize, merge, recordLocal, tick, toShared } from './engine';
import { normalizeState } from '../redux/store';

// What the app sees: the synced data after the store's usual clean-up.
const normalize = (s) => normalizeState(s, 'wed');

const timer = (fields = {}) => ({
  id: 1, day: 'mon', title: 'Deep work', seconds: 1500, secondsSpent: 0, initial: 1500, reps: 0, repsOn: {}, pomodoro: null, ...fields,
});
const state = (parts = {}) => ({ timers: [], notes: [], todos: [], habits: [], milestones: [], embeds: [], journal: {}, focus: {}, ...parts });

// A device: its own meta, recording its state at a given time.
function device(id) {
  let meta = emptyMeta(id);
  return {
    record(s, now) {
      meta = recordLocal(meta, s, now).meta;
      return this;
    },
    pull(other) {
      meta = merge(meta, toShared(other.meta));
      return this;
    },
    get meta() {
      return meta;
    },
    get state() {
      return normalize(materialize(meta));
    },
  };
}

test('cell kinds', () => {
  expect(kindOf(['timers', 1, 'reps'])).toBe('counter');
  expect(kindOf(['focus', '2026-10-28', 'deep work', 'seconds'])).toBe('counter');
  expect(kindOf(['habits', 3, 'log', '2026-10-28', 'plusAt'])).toBe('set');
  expect(kindOf(['timers', 1, 'secondsSpent'])).toBe('device');
  expect(kindOf(['timers', 1, 'title'])).toBe('lww');
});

test('clock stamps always increase, even if the wall clock goes back', () => {
  const a = tick({ ms: 0, c: 0 }, 'A', 1000);
  const b = tick(a.clock, 'A', 1000);
  const c = tick(b.clock, 'A', 500);
  expect(a.stamp < b.stamp && b.stamp < c.stamp).toBe(true);
});

test('a state survives the round trip through cells', () => {
  const s = state({
    timers: [timer({ reps: 3, repsOn: { '2026-10-27': 3 }, pomodoro: { breakSeconds: 300, longBreakSeconds: 900, longEvery: 4, autoBreak: true } })],
    journal: { '2026-10-27': 'Good day' },
    focus: { '2026-10-27': { 'deep work': { title: 'Deep work', seconds: 4500, rounds: 3 } } },
    habits: [{ id: 5, kind: 'routine', name: 'Urge', createdOn: '2026-10-01', log: { '2026-10-27': { plus: 2, minus: 1, plusAt: [3, 1] } }, auto: null }],
  });
  const a = device('A').record(normalize(s), 1000);
  expect(a.state).toEqual(normalize({
    ...s,
    habits: [{ ...s.habits[0], log: { '2026-10-27': { plus: 2, minus: 1, plusAt: [1, 3] } } }],
  }));
});

test('recording the state the engine just produced changes nothing (no echo after applying a sync)', () => {
  const a = device('A').record(state({ timers: [timer({ reps: 2, repsOn: { '2026-10-27': 2 } })], focus: { '2026-10-27': { x: { title: 'X', seconds: 60, rounds: 1 } } } }), 1000);
  const b = device('B').pull(a);
  expect(recordLocal(b.meta, b.state, 5000).shared).toBe(false);
});

test('recording the same state twice changes nothing', () => {
  const s = state({ timers: [timer()] });
  const first = recordLocal(emptyMeta('A'), s, 1000);
  const second = recordLocal(first.meta, s, 2000);
  expect(first).toMatchObject({ changed: true, shared: true });
  expect(second).toMatchObject({ changed: false, shared: false });
  expect(second.meta).toEqual(first.meta);
});

describe('two devices', () => {
  test('a new timer on one device shows up on the other', () => {
    const a = device('A').record(state({ timers: [timer()] }), 1000);
    const b = device('B').pull(a);
    expect(b.state.timers).toEqual(normalize(state({ timers: [timer()] })).timers);
  });

  test('the later edit of the same field wins; edits of different fields both stay', () => {
    const a = device('A').record(state({ timers: [timer()] }), 1000);
    const b = device('B').pull(a);
    a.record(state({ timers: [timer({ title: 'Writing' })] }), 2000);
    b.record(state({ timers: [timer({ title: 'Reading', seconds: 600, initial: 600 })] }), 3000);
    a.pull(b);
    b.pull(a);
    expect(a.state.timers[0]).toMatchObject({ title: 'Reading', seconds: 600 });
    expect(b.state).toEqual(a.state);

    // Different fields: A renames, B changes the length; both survive.
    a.record(state({ timers: [timer({ title: 'Focus', seconds: 600, initial: 600 })] }), 4000);
    b.record(state({ timers: [timer({ title: 'Reading', seconds: 900, initial: 900 })] }), 5000);
    a.pull(b);
    b.pull(a);
    expect(a.state.timers[0]).toMatchObject({ title: 'Focus', seconds: 900, initial: 900 });
    expect(b.state).toEqual(a.state);
  });

  test('counts made on both devices add up instead of overwriting', () => {
    const a = device('A').record(state({ timers: [timer({ reps: 2, repsOn: { '2026-10-27': 2 } })] }), 1000);
    const b = device('B').pull(a);
    // Offline, each finishes one more round today.
    a.record(state({ timers: [timer({ reps: 3, repsOn: { '2026-10-27': 2, '2026-10-28': 1 } })] }), 2000);
    b.record(state({ ...b.state, timers: [{ ...b.state.timers[0], reps: 3, repsOn: { '2026-10-27': 2, '2026-10-28': 1 } }] }), 2000);
    a.pull(b);
    b.pull(a);
    expect(a.state.timers[0]).toMatchObject({ reps: 4, repsOn: { '2026-10-27': 2, '2026-10-28': 2 } });
    expect(b.state).toEqual(a.state);
  });

  test('focus time from both devices adds up, and the title follows the latest edit', () => {
    const f = (seconds, rounds, title = 'Deep work') => ({ '2026-10-28': { 'deep work': { title, seconds, rounds } } });
    const a = device('A').record(state({ focus: f(600, 0) }), 1000);
    const b = device('B').pull(a);
    a.record(state({ focus: f(1500, 1) }), 2000);
    b.record(state({ focus: f(900, 0, 'deep Work') }), 3000);
    a.pull(b);
    expect(a.state.focus).toEqual(f(1800, 1, 'deep Work'));
  });

  test('a count going down on one device is shared too', () => {
    const habit = (plus, minus) => ({ id: 5, kind: 'routine', name: 'Urge', createdOn: '2026-10-01', log: { '2026-10-28': { plus, minus } }, auto: null });
    const a = device('A').record(state({ habits: [habit(3, 0)] }), 1000);
    const b = device('B').pull(a);
    b.record(state({ habits: [habit(2, 1)] }), 2000);
    a.pull(b);
    expect(a.state.habits[0].log['2026-10-28']).toEqual({ plus: 2, minus: 1 });
  });

  test('tap times merge as a union', () => {
    const habit = (plusAt) => ({ id: 5, kind: 'routine', name: 'Urge', createdOn: '2026-10-01', log: { '2026-10-28': { plus: plusAt.length, minus: 0, plusAt } }, auto: null });
    const a = device('A').record(state({ habits: [habit([10])] }), 1000);
    const b = device('B').pull(a);
    a.record(state({ habits: [habit([10, 20])] }), 2000);
    b.record(state({ habits: [habit([10, 30])] }), 2000);
    a.pull(b);
    expect(a.state.habits[0].log['2026-10-28']).toEqual({ plus: 3, minus: 0, plusAt: [10, 20, 30] });
    b.pull(a);
    expect(b.state).toEqual(a.state);
  });

  test('a delete wins over a concurrent edit, and stays deleted', () => {
    const a = device('A').record(state({ todos: [{ id: 7, day: 'mon', text: 'Call', doneOn: null }] }), 1000);
    const b = device('B').pull(a);
    a.record(state({ todos: [] }), 2000);
    b.record(state({ todos: [{ id: 7, day: 'mon', text: 'Call mum', doneOn: null }] }), 3000);
    a.pull(b);
    b.pull(a);
    expect(a.state.todos).toEqual([]);
    expect(b.state.todos).toEqual([]);
    // B still has the todo in its app state until it applies the merge, and
    // recording that stale state must not bring it back.
    b.record(state({ todos: [{ id: 7, day: 'mon', text: 'Call mum', doneOn: null }] }), 4000);
    expect(b.state.todos).toEqual([]);
  });

  test('a cleared journal entry is cleared everywhere', () => {
    const a = device('A').record(state({ journal: { '2026-10-28': 'Draft' } }), 1000);
    const b = device('B').pull(a);
    a.record(state({ journal: {} }), 2000);
    b.pull(a);
    expect(b.state.journal).toEqual({});
  });

  test('progress of the current round is not worth a sync on its own', () => {
  const a = device('A').record(state({ timers: [timer()] }), 1000);
  const next = recordLocal(a.meta, state({ timers: [timer({ secondsSpent: 600 })] }), 2000);
  expect(next).toMatchObject({ changed: true, shared: false });
});

test('the current round\'s progress stays on its device', () => {
    const a = device('A').record(state({ timers: [timer({ secondsSpent: 600 })] }), 1000);
    expect(JSON.stringify(toShared(a.meta))).not.toContain('secondsSpent');
    const b = device('B').record(state({ timers: [timer({ secondsSpent: 60 })] }), 1000).pull(a);
    expect(b.state.timers[0].secondsSpent).toBe(60);
  });

  test('new records keep each list\'s order: newest first for timers, last for todos', () => {
    const a = device('A').record(state({ timers: [timer({ id: 1 })], todos: [{ id: 10, day: 'mon', text: 'a', doneOn: null }] }), 1000);
    const b = device('B').pull(a);
    b.record(state({
      timers: [timer({ id: 2, title: 'New' }), ...b.state.timers],
      todos: [...b.state.todos, { id: 11, day: 'mon', text: 'b', doneOn: null }],
    }), 2000);
    a.pull(b);
    expect(a.state.timers.map((t) => t.id)).toEqual([2, 1]);
    expect(a.state.todos.map((t) => t.id)).toEqual([10, 11]);
    b.pull(a);
    expect(b.state.timers.map((t) => t.id)).toEqual([2, 1]);
  });
});

describe('merge laws (so devices agree whatever order they sync in)', () => {
  const build = () => {
    const a = device('A').record(state({ timers: [timer({ reps: 1 })], journal: { '2026-10-27': 'A' } }), 1000);
    const b = device('B').record(state({ todos: [{ id: 9, day: 'tue', text: 'x', doneOn: null }], journal: { '2026-10-27': 'B' } }), 2000);
    const c = device('C').record(state({ focus: { '2026-10-27': { x: { title: 'X', seconds: 60, rounds: 0 } } } }), 3000);
    return [a.meta, b.meta, c.meta].map(toShared);
  };
  const base = (id) => ({ ...emptyMeta(id) });
  const shared = (meta) => normalize(materialize(meta));

  test('commutative', () => {
    const [a, b] = build();
    expect(shared(merge(merge(base('X'), a), b))).toEqual(shared(merge(merge(base('X'), b), a)));
  });

  test('associative', () => {
    const [a, b, c] = build();
    const left = merge(merge(merge(base('X'), a), b), c);
    const right = merge(base('X'), toShared(merge(merge(base('Y'), b), c)));
    expect(shared(merge(left, a))).toEqual(shared(merge(right, a)));
  });

  test('idempotent', () => {
    const [a] = build();
    const once = merge(base('X'), a);
    expect(merge(once, a)).toEqual(once);
  });
});

test('hasData tells an empty state from one with something in it', () => {
  expect(hasData(state())).toBe(false);
  expect(hasData(state({ journal: { '2026-10-28': 'x' } }))).toBe(true);
});

test('flatten skips records without a usable id', () => {
  expect(flatten(state({ notes: [{ content: 'no id' }] })).records.get('notes')).toEqual([]);
});

describe('found in review', () => {
  const routine = (plus, plusAt) => ({ id: 5, kind: 'routine', name: 'Urge', createdOn: '2026-10-01', log: plus || plusAt?.length ? { '2026-10-28': { plus, minus: 0, ...(plusAt ? { plusAt } : {}) } } : {}, auto: null });

  test('two devices undoing the same tap leave 0, not a tap that comes back', () => {
    const a = device('A').record(state({ habits: [routine(1, [100])] }), 1000);
    const b = device('B').pull(a);
    const c = device('C').pull(a);
    a.record(state({ habits: [routine(0)] }), 2000);
    b.record(state({ habits: [routine(0)] }), 2000);
    // Every device pulls from every other, several rounds, in a messy order.
    for (const [x, y] of [[a, b], [c, a], [b, c], [a, c], [c, b], [b, a], [a, b], [c, a]]) {
      x.pull(y);
      x.record(x.state, 3000);
    }
    for (const d of [a, b, c]) expect(d.state.habits[0].log).toEqual({});
  });

  test('an undone tap time stays undone after a sync', () => {
    const a = device('A').record(state({ habits: [routine(2, [100, 500])] }), 1000);
    const b = device('B').pull(a);
    b.record(state({ habits: [routine(1, [100])] }), 2000);
    a.pull(b);
    expect(a.state.habits[0].log['2026-10-28'].plusAt).toEqual([100]);
  });

  test('renaming the same timer on two devices doesn\'t bring back the old name\'s focus time', () => {
    const focus = (entries) => Object.fromEntries(entries.map(([key, title]) => [key, { title, seconds: 3000, rounds: 2 }]));
    const a = device('A').record(state({ focus: { '2026-10-27': focus([['deep work', 'Deep work']]) } }), 1000);
    const b = device('B').pull(a);
    a.record(state({ focus: { '2026-10-27': focus([['writing', 'Writing']]) } }), 2000);
    b.record(state({ focus: { '2026-10-27': focus([['study', 'Study']]) } }), 2000);
    a.pull(b);
    a.record(a.state, 3000);
    b.pull(a);
    expect(Object.keys(a.state.focus['2026-10-27']).sort()).toEqual(['study', 'writing']);
    expect(b.state.focus).toEqual(a.state.focus);
  });

  test('records added on two devices at once end up in the same order everywhere', () => {
    const a = device('A').record(state({ timers: [timer({ id: 1 })] }), 1000);
    const b = device('B').pull(a);
    a.record(state({ timers: [timer({ id: 2 }), timer({ id: 1 })] }), 2000);
    b.record(state({ timers: [timer({ id: 3 }), timer({ id: 1 })] }), 2000);
    a.pull(b);
    b.pull(a);
    expect(a.state.timers.map((t) => t.id)).toEqual(b.state.timers.map((t) => t.id));
  });

  test('the order on the first device is kept when sync starts', () => {
    const s = state({ timers: [timer({ id: 7 }), timer({ id: 3 }), timer({ id: 9 })], todos: [{ id: 5, day: 'mon', text: 'a', doneOn: null }, { id: 2, day: 'mon', text: 'b', doneOn: null }] });
    const a = device('A').record(s, 1000);
    expect(a.state.timers.map((t) => t.id)).toEqual([7, 3, 9]);
    expect(a.state.todos.map((t) => t.id)).toEqual([5, 2]);
  });
});

test('a backup restored with sync on brings back a record deleted earlier (new ids)', async () => {
  const { withFreshIds } = await import('../redux/store');
  const todo = { id: 7, day: 'mon', text: 'Call', doneOn: null };
  const a = device('A').record(state({ todos: [todo] }), 1000);
  a.record(state({ todos: [] }), 2000);
  const restored = withFreshIds(normalize(state({ todos: [todo] })));
  expect(restored.todos[0].id).not.toBe(7);
  a.record(restored, 3000);
  const b = device('B').pull(a);
  expect(b.state.todos.map((t) => t.text)).toEqual(['Call']);
});
