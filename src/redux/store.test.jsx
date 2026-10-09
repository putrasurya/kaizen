import { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { store, StoreProvider, loadState, STATE_VERSION, isTodoDone } from './store';
import { DAYS } from '../utilities/day-helper';

// redux/store.js's action functions (addTimer, deleteNote, ...) only exist on the
// context value provided by StoreProvider, not on the module's default context value
// (which is just the {timers, notes, embeds} state shape). This harness renders one
// button per action so tests can dispatch and observe the resulting state/localStorage
// writes through the public StoreProvider API, without reaching into reducer
// internals.
function Harness() {
  const ctx = useContext(store);
  const timer = ctx.timers[0];
  const note = ctx.notes[0];
  const embed = ctx.embeds[0];

  return (
    <div>
      <pre data-testid="state">{JSON.stringify(ctx.timers)}|{JSON.stringify(ctx.notes)}|{JSON.stringify(ctx.embeds)}</pre>
      <button onClick={() => ctx.addTimer('Focus', 3600)}>addTimer</button>
      <button onClick={() => timer && ctx.updateSecondsSpent(timer.id, 120)}>updateSecondsSpent</button>
      <button onClick={() => timer && ctx.incrementReps(timer.id)}>incrementReps</button>
      <button onClick={() => timer && ctx.deleteTimer(timer.id)}>deleteTimer</button>
      <button onClick={() => ctx.addNote('remember this')}>addNote</button>
      <button onClick={() => note && ctx.deleteNote(note.id)}>deleteNote</button>
      <button onClick={() => ctx.addEmbed('abc123')}>addEmbed</button>
      <button onClick={() => embed && ctx.deleteEmbed(embed.id)}>deleteEmbed</button>
    </div>
  );
}

function renderHarness() {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <Harness />
    </StoreProvider>
  );
  return user;
}

function readState() {
  return screen.getByTestId('state').textContent;
}

function readPersistedState() {
  return JSON.parse(window.localStorage.getItem(import.meta.env.VITE_STORAGEKEY));
}

describe('store reducer (via StoreProvider)', () => {
  test('addTimer adds a timer with initial reps/secondsSpent and persists it', async () => {
    const user = renderHarness();

    await user.click(screen.getByText('addTimer'));

    expect(readState()).toContain('"title":"Focus"');
    expect(readState()).toContain('"seconds":3600');
    expect(readState()).toContain('"reps":0');
    expect(readPersistedState().timers[0]).toMatchObject({ title: 'Focus', seconds: 3600, reps: 0 });
  });

  test('updateSecondsSpent updates the matching timer only', async () => {
    const user = renderHarness();

    await user.click(screen.getByText('addTimer'));
    await user.click(screen.getByText('updateSecondsSpent'));

    expect(readState()).toContain('"secondsSpent":120');
    expect(readPersistedState().timers[0].secondsSpent).toBe(120);
  });

  test('incrementReps counts each finished round, per date, and reps cannot be reset', async () => {
    const user = renderHarness();

    await user.click(screen.getByText('addTimer'));
    await user.click(screen.getByText('incrementReps'));
    await user.click(screen.getByText('incrementReps'));
    const timer = readPersistedState().timers[0];
    expect(timer.reps).toBe(2);
    expect(Object.values(timer.repsOn)).toEqual([2]);
    expect(screen.queryByText('resetReps')).not.toBeInTheDocument();
  });

  test('deleteTimer removes the timer', async () => {
    const user = renderHarness();

    await user.click(screen.getByText('addTimer'));
    expect(readState()).toContain('"title":"Focus"');

    await user.click(screen.getByText('deleteTimer'));
    expect(readPersistedState().timers).toEqual([]);
  });

  test('addNote and deleteNote', async () => {
    const user = renderHarness();

    await user.click(screen.getByText('addNote'));
    expect(readState()).toContain('remember this');
    expect(readPersistedState().notes[0]).toMatchObject({ content: 'remember this' });

    await user.click(screen.getByText('deleteNote'));
    expect(readPersistedState().notes).toEqual([]);
  });

  test('addEmbed and deleteEmbed', async () => {
    const user = renderHarness();

    await user.click(screen.getByText('addEmbed'));
    expect(readState()).toContain('abc123');
    expect(readPersistedState().embeds[0]).toMatchObject({ link: 'abc123' });

    await user.click(screen.getByText('deleteEmbed'));
    expect(readPersistedState().embeds).toEqual([]);
  });
});

describe('copyTimer', () => {
  function CopyHarness() {
    const ctx = useContext(store);
    const [original] = ctx.timers.filter((t) => t.day === 'mon');
    const copy = ctx.timers.find((t) => t.day === 'tue');
    return (
      <div>
        <pre data-testid="timers">{JSON.stringify(ctx.timers)}</pre>
        <button onClick={() => ctx.addTimer('Focus', 3600, 0, false, 'mon')}>add</button>
        <button onClick={() => ctx.incrementReps(original.id)}>repOriginal</button>
        <button onClick={() => ctx.updateSecondsSpent(original.id, 900)}>spendOriginal</button>
        <button onClick={() => ctx.copyTimer(original.id, ['tue', 'wed', 'mon'])}>copy</button>
        <button onClick={() => ctx.incrementReps(copy.id)}>repCopy</button>
      </div>
    );
  }

  test('copies get unique ids, the same settings, fresh state, and change independently', async () => {
    const user = userEvent.setup();
    render(
      <StoreProvider>
        <CopyHarness />
      </StoreProvider>
    );
    const timers = () => JSON.parse(screen.getByTestId('timers').textContent);

    await user.click(screen.getByText('add'));
    await user.click(screen.getByText('repOriginal'));
    await user.click(screen.getByText('spendOriginal'));
    await user.click(screen.getByText('copy'));

    // 'mon' is the source's own day, so only tue and wed get a copy.
    expect(timers().map((t) => t.day).sort()).toEqual(['mon', 'tue', 'wed']);
    expect(new Set(timers().map((t) => t.id)).size).toBe(3);
    for (const day of ['tue', 'wed']) {
      expect(timers().find((t) => t.day === day)).toMatchObject({
        title: 'Focus', seconds: 3600, initial: 3600, secondsSpent: 0, reps: 0,
      });
    }

    await user.click(screen.getByText('repCopy'));
    expect(timers().find((t) => t.day === 'tue').reps).toBe(1);
    expect(timers().find((t) => t.day === 'mon')).toMatchObject({ reps: 1, secondsSpent: 900 });
    expect(timers().find((t) => t.day === 'wed').reps).toBe(0);

    // Copying again skips days that already have an identical timer.
    await user.click(screen.getByText('copy'));
    expect(timers()).toHaveLength(3);
  });
});

describe('loadState (persistence and migration)', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;
  const legacy = {
    timers: [
      { id: 1700000000000, title: 'Deep Work', seconds: 3600, secondsSpent: 1200, initial: 3600, reps: 4 },
      { id: 1700000000001, title: 'Reading', seconds: 1800, secondsSpent: 0, initial: 1800, reps: 0 },
    ],
    notes: [{ id: 1, content: 'keep me' }],
    embeds: [{ id: 2, link: 'abc123' }],
  };

  test('migrates legacy timers into one independent copy per weekday', () => {
    window.localStorage.setItem(KEY, JSON.stringify(legacy));

    const state = loadState(KEY, 'wed');

    expect(state.version).toBe(STATE_VERSION);
    expect(state.embeds).toEqual(legacy.embeds);
    expect(state.timers).toHaveLength(14);
    expect(new Set(state.timers.map((t) => t.id)).size).toBe(14);
    for (const day of DAYS) {
      expect(state.timers.filter((t) => t.day === day).map((t) => t.title)).toEqual(['Deep Work', 'Reading']);
    }
    // Today's copy is the original record, progress and all...
    expect(state.timers.find((t) => t.day === 'wed' && t.title === 'Deep Work'))
      .toEqual({ ...legacy.timers[0], day: 'wed', repsOn: {}, pomodoro: null });
    // ...and the other days start fresh with the same settings.
    expect(state.timers.find((t) => t.day === 'mon' && t.title === 'Deep Work'))
      .toMatchObject({ seconds: 3600, initial: 3600, secondsSpent: 0, reps: 0 });
    // Written back immediately, with the version.
    expect(readPersistedState()).toEqual(state);
  });

  test('runs only once: reloading migrated data does not multiply timers', () => {
    window.localStorage.setItem(KEY, JSON.stringify(legacy));
    const first = loadState(KEY, 'wed');

    // The user deletes some copies; a later load must not "restore" them.
    const edited = { ...first, timers: first.timers.filter((t) => t.day === 'wed') };
    window.localStorage.setItem(KEY, JSON.stringify(edited));
    const second = loadState(KEY, 'fri');

    expect(second.timers).toEqual(edited.timers);
    expect(loadState(KEY, 'fri')).toEqual(second);
  });

  test('StoreProvider loads migrated state on mount', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 10)); // a Friday
    try {
      window.localStorage.setItem(KEY, JSON.stringify(legacy));
      renderHarness();
      const timers = JSON.parse(readState().split('|')[0]);
      expect(timers).toHaveLength(14);
      expect(timers.find((t) => t.id === legacy.timers[0].id)).toMatchObject({ day: 'fri', reps: 4 });
    } finally {
      vi.useRealTimers();
    }
  });

  test('missing storage gives an empty current-version state', () => {
    expect(loadState(KEY, 'mon')).toEqual({ version: STATE_VERSION, timers: [], notes: [], todos: [], habits: [], journal: {}, milestones: [], embeds: [] });
  });

  test('unparseable storage does not crash and is backed up instead of lost', () => {
    window.localStorage.setItem(KEY, '{"timers": [oops');

    expect(loadState(KEY, 'mon')).toEqual({ version: STATE_VERSION, timers: [], notes: [], todos: [], habits: [], journal: {}, milestones: [], embeds: [] });
    expect(window.localStorage.getItem(`${KEY}.backup`)).toBe('{"timers": [oops');
  });

  test.each([['null'], ['[]'], ['42'], ['"text"']])('non-object JSON %s gives an empty state', (raw) => {
    window.localStorage.setItem(KEY, raw);
    expect(loadState(KEY, 'mon').timers).toEqual([]);
  });

  test('malformed fields and timers are repaired or dropped', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 2,
      timers: [
        null,
        'junk',
        { id: 5, title: 'No day', seconds: 600, secondsSpent: 9999, reps: -1 },
        { id: 5, title: 'Duplicate id', seconds: 'x', day: 'tue' },
      ],
      notes: 'not a list',
    }));

    const state = loadState(KEY, 'thu');

    expect(state.notes).toEqual([]);
    expect(state.todos).toEqual([]);
    expect(state.embeds).toEqual([]);
    expect(state.timers).toHaveLength(2);
    // No day on current-version data: shown today rather than lost.
    // Spent past its length: a finished round, which now means ready again.
    expect(state.timers[0]).toMatchObject({ id: 5, day: 'thu', seconds: 600, secondsSpent: 0, initial: 600, reps: 0 });
    expect(state.timers[1]).toMatchObject({ title: 'Duplicate id', day: 'tue', seconds: 0 });
    expect(state.timers[1].id).not.toBe(5);
  });
});

describe('v3: notes per day and todos', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;
  const v2 = {
    version: 2,
    timers: [{ id: 10, day: 'mon', title: 'Gym', seconds: 600, secondsSpent: 0, initial: 600, reps: 0 }],
    notes: [{ id: 1, content: 'call mum' }, { id: 2, content: 'buy milk' }],
    embeds: [],
  };

  test('v2 -> v3 copies each note to every weekday, keeps timers, and starts with no todos', () => {
    window.localStorage.setItem(KEY, JSON.stringify(v2));

    const state = loadState(KEY, 'fri');

    expect(state.version).toBe(STATE_VERSION);
    expect(state.timers).toEqual(v2.timers.map((t) => ({ ...t, repsOn: {}, pomodoro: null })));
    expect(state.todos).toEqual([]);
    expect(state.notes).toHaveLength(14);
    expect(new Set(state.notes.map((n) => n.id)).size).toBe(14);
    for (const day of DAYS) {
      expect(state.notes.filter((n) => n.day === day).map((n) => n.content)).toEqual(['call mum', 'buy milk']);
    }
    // Today's copy is the original note.
    expect(state.notes.find((n) => n.day === 'fri' && n.content === 'call mum').id).toBe(1);
    expect(readPersistedState()).toEqual(state);
  });

  test('legacy (no version) -> v3 in a single load', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      timers: [{ id: 1, title: 'Read', seconds: 60, secondsSpent: 0, initial: 60, reps: 0 }],
      notes: [{ id: 1, content: 'hello' }],
    }));

    const state = loadState(KEY, 'tue');

    expect(state.version).toBe(STATE_VERSION);
    expect(state.timers).toHaveLength(7);
    expect(state.notes).toHaveLength(7);
    expect(state.notes.map((n) => n.day).sort()).toEqual([...DAYS].sort());
    expect(state.todos).toEqual([]);
    expect(readPersistedState().version).toBe(STATE_VERSION);
  });

  test('runs only once: deleted note copies and todos are not reset on reload', () => {
    window.localStorage.setItem(KEY, JSON.stringify(v2));
    const first = loadState(KEY, 'fri');

    const edited = {
      ...first,
      notes: first.notes.filter((n) => n.day === 'fri'),
      todos: [{ id: 5, day: 'mon', text: 'stretch', doneOn: null }],
    };
    window.localStorage.setItem(KEY, JSON.stringify(edited));
    const second = loadState(KEY, 'sat');

    expect(second).toEqual(edited);
    expect(loadState(KEY, 'sun')).toEqual(second);
  });

  test('malformed notes and todos are repaired or dropped, with unique ids', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 3,
      timers: [],
      notes: [null, { id: 1, content: 'no day' }, { id: 1, day: 'wed', content: 'dup id' }, { id: 2, day: 'xyz', content: 7 }],
      todos: [
        'junk',
        { id: 1, day: 'mon', text: '   ' },
        { id: 1, text: 42 },
        { id: 3, day: 'mon', text: 'a', doneOn: '2026-09-28' },
        { id: 3, day: 'nope', text: 'b', doneOn: 'yesterday' },
        { day: 'tue', text: 'c', done: true },
      ],
    }));

    const state = loadState(KEY, 'thu');

    expect(state.notes).toHaveLength(3);
    expect(state.notes[0]).toMatchObject({ id: 1, day: 'thu', content: 'no day' });
    expect(state.notes[1]).toMatchObject({ day: 'wed', content: 'dup id' });
    expect(state.notes[1].id).not.toBe(1);
    expect(state.notes[2]).toMatchObject({ id: 2, day: 'thu', content: '7' });

    expect(state.todos).toHaveLength(3);
    expect(state.todos[0]).toEqual({ id: 3, day: 'mon', text: 'a', doneOn: '2026-09-28' });
    expect(state.todos[1]).toMatchObject({ day: 'thu', text: 'b', doneOn: null });
    expect(state.todos[2]).toMatchObject({ day: 'tue', text: 'c', doneOn: null });
    expect(new Set(state.todos.map((t) => t.id)).size).toBe(3);
  });
});

describe('isTodoDone', () => {
  // 2026-10-02 is a Friday; its Monday-first week runs 2026-09-28 .. 2026-10-04.
  test.each([
    ['fri', '2026-10-02', '2026-10-02', true],
    ['fri', '2026-10-02', '2026-10-09', false], // a week later: unchecked again
    ['mon', '2026-09-28', '2026-10-02', true], // earlier this week
    ['sat', '2026-10-03', '2026-10-02', true], // ticked ahead for later this week
    ['sun', '2026-09-27', '2026-10-02', false], // last week's Sunday
    ['mon', null, '2026-10-02', false],
  ])('%s todo done on %s, today %s -> %s', (day, doneOn, today, expected) => {
    expect(isTodoDone({ day, doneOn }, today)).toBe(expected);
  });
});

describe('habits', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;

  function HabitHarness() {
    const ctx = useContext(store);
    const [daily, routine] = [ctx.habits.find((h) => h.kind === 'daily'), ctx.habits.find((h) => h.kind === 'routine')];
    return (
      <div>
        <pre data-testid="habits">{JSON.stringify(ctx.habits)}</pre>
        <button onClick={() => ctx.addHabit('daily', '  Pray  ', 5)}>addDaily</button>
        <button onClick={() => ctx.addHabit('routine', 'No smoking')}>addRoutine</button>
        <button onClick={() => ctx.addHabit('daily', '   ', 5)}>addBlank</button>
        <button onClick={() => ctx.setDailyCount(daily.id, '2026-10-02', 3)}>fill3</button>
        <button onClick={() => ctx.setDailyCount(daily.id, '2026-10-02', 9)}>fill9</button>
        <button onClick={() => ctx.setDailyCount(daily.id, '2026-10-02', 0)}>empty</button>
        <button onClick={() => ctx.editHabit(daily.id, 'Salat', 3)}>edit</button>
        <button onClick={() => ctx.logRoutine(routine.id, 'minus', 1, '2026-10-02')}>minus</button>
        <button onClick={() => ctx.logRoutine(routine.id, 'minus', -1, '2026-10-02')}>undoMinus</button>
        <button onClick={() => ctx.logRoutine(routine.id, 'plus', 1, '2026-10-02')}>plus</button>
        <button onClick={() => ctx.deleteHabit(routine.id)}>deleteRoutine</button>
      </div>
    );
  }

  function setup() {
    const user = userEvent.setup();
    render(<StoreProvider><HabitHarness /></StoreProvider>);
    const habits = () => JSON.parse(screen.getByTestId('habits').textContent);
    const click = (name) => user.click(screen.getByText(name));
    return { habits, click };
  }

  test('adds trimmed daily and routine habits; blank names are ignored', async () => {
    const { habits, click } = setup();
    await click('addDaily');
    await click('addRoutine');
    await click('addBlank');

    expect(habits()).toMatchObject([
      { kind: 'daily', name: 'Pray', target: 5, log: {}, createdOn: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
      { kind: 'routine', name: 'No smoking', log: {} },
    ]);
    expect(habits()[1]).not.toHaveProperty('target');
    expect(readPersistedState().habits).toHaveLength(2);
  });

  test('daily counts are capped at the target and empty days leave the log', async () => {
    const { habits, click } = setup();
    await click('addDaily');

    await click('fill3');
    expect(habits()[0].log).toEqual({ '2026-10-02': 3 });
    await click('fill9');
    expect(habits()[0].log).toEqual({ '2026-10-02': 5 });
    await click('empty');
    expect(habits()[0].log).toEqual({});
  });

  test('editing renames and changes the target', async () => {
    const { habits, click } = setup();
    await click('addDaily');
    await click('edit');
    expect(habits()[0]).toMatchObject({ name: 'Salat', target: 3 });
  });

  test('routine taps count per day, undo never goes below zero, and delete removes it', async () => {
    const { habits, click } = setup();
    await click('addRoutine');

    await click('minus');
    await click('minus');
    await click('plus');
    const day = () => habits()[0].log['2026-10-02'];
    expect(day()).toMatchObject({ plus: 1, minus: 2 });
    // Each tap saves when it happened, which the auto-tap clock restarts from.
    expect(day().minusAt).toHaveLength(2);
    expect(day().plusAt).toHaveLength(1);

    await click('undoMinus');
    await click('undoMinus');
    await click('undoMinus');
    expect(day()).toMatchObject({ plus: 1, minus: 0 });
    expect(day()).not.toHaveProperty('minusAt');

    await click('deleteRoutine');
    expect(habits()).toEqual([]);
  });

  test('v3 -> v4 adds an empty habit list and leaves everything else alone', () => {
    const v3 = { version: 3, timers: [], notes: [{ id: 1, day: 'mon', content: 'x' }], todos: [], embeds: [] };
    window.localStorage.setItem(KEY, JSON.stringify(v3));

    const state = loadState(KEY, 'fri');
    expect(state.version).toBe(STATE_VERSION);
    expect(state.habits).toEqual([]);
    expect(state.notes).toEqual(v3.notes);
    expect(readPersistedState().version).toBe(STATE_VERSION);
  });

  test('malformed habits are repaired or dropped, with unique ids', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 4, timers: [], notes: [], todos: [], embeds: [],
      habits: [
        null,
        { id: 1, kind: 'weekly', name: 'x' },
        { id: 1, kind: 'daily', name: '  ' },
        { id: 2, kind: 'daily', name: 'Pray', target: 50, log: { '2026-10-02': 3, bad: 2, '2026-10-01': -1, '2026-09-30': 1.5 } },
        { id: 2, kind: 'routine', name: 'Urge', target: 4, log: { '2026-10-02': { plus: 2, minus: 'x' }, '2026-10-01': { plus: 0, minus: 0 } } },
      ],
    }));

    const { habits } = loadState(KEY, 'fri');
    expect(habits).toHaveLength(2);
    // No createdOn: the first logged day stands in.
    expect(habits[0]).toEqual({ id: 2, kind: 'daily', name: 'Pray', createdOn: '2026-10-02', target: 20, log: { '2026-10-02': 3 } });
    expect(habits[1]).toMatchObject({ kind: 'routine', name: 'Urge', log: { '2026-10-02': { plus: 2, minus: 0 } } });
    expect(habits[1]).not.toHaveProperty('target');
    expect(habits[1].id).not.toBe(2);
  });
});

describe('journal', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;

  function JournalHarness() {
    const ctx = useContext(store);
    return (
      <div>
        <pre data-testid="journal">{JSON.stringify(ctx.journal)}</pre>
        <button onClick={() => ctx.setJournalEntry('2026-10-02', 'Dear diary')}>write</button>
        <button onClick={() => ctx.setJournalEntry('2026-10-02', '   ')}>blank</button>
        <button onClick={() => ctx.setJournalEntry('Friday', 'x')}>badDate</button>
      </div>
    );
  }

  test('writes, ignores bad dates, and removes blank entries', async () => {
    const user = userEvent.setup();
    render(<StoreProvider><JournalHarness /></StoreProvider>);
    const journal = () => JSON.parse(screen.getByTestId('journal').textContent);

    await user.click(screen.getByText('write'));
    expect(journal()).toEqual({ '2026-10-02': 'Dear diary' });
    expect(readPersistedState().journal).toEqual({ '2026-10-02': 'Dear diary' });

    await user.click(screen.getByText('badDate'));
    expect(journal()).toEqual({ '2026-10-02': 'Dear diary' });

    await user.click(screen.getByText('blank'));
    expect(journal()).toEqual({});
  });

  test('v4 -> v5 adds an empty journal; malformed entries are dropped', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ version: 4, timers: [], notes: [], todos: [], habits: [], embeds: [] }));
    expect(loadState(KEY, 'fri')).toMatchObject({ version: STATE_VERSION, journal: {} });

    window.localStorage.setItem(KEY, JSON.stringify({
      version: 5, timers: [], notes: [], todos: [], habits: [], embeds: [],
      journal: { '2026-10-02': 'kept', '2026-10-01': '  ', yesterday: 'bad key', '2026-09-30': 42 },
    }));
    expect(loadState(KEY, 'fri').journal).toEqual({ '2026-10-02': 'kept' });
  });
});

describe('routine auto tap', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;
  const NOW = new Date(2026, 9, 6, 9, 0).getTime(); // Tue 09:00

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  function AutoHarness() {
    const ctx = useContext(store);
    const routine = ctx.habits[0];
    return (
      <div>
        <pre data-testid="habits">{JSON.stringify(ctx.habits)}</pre>
        <button onClick={() => ctx.addHabit('routine', 'Smoke', null, { direction: 'plus', everyMinutes: 60, maxPerDay: 8 })}>addAuto</button>
        <button onClick={() => ctx.addHabit('routine', 'Plain')}>addPlain</button>
        <button onClick={() => ctx.editHabit(routine.id, 'Smoke', null, { direction: 'minus', everyMinutes: 90, maxPerDay: 6 })}>editAuto</button>
        <button onClick={() => ctx.editHabit(routine.id, 'Renamed')}>rename</button>
        <button onClick={() => ctx.editHabit(routine.id, 'Smoke', null, null)}>off</button>
      </div>
    );
  }

  function setup() {
    const user = userEvent.setup();
    render(<StoreProvider><AutoHarness /></StoreProvider>);
    return {
      habit: () => JSON.parse(screen.getByTestId('habits').textContent)[0],
      click: (name) => user.click(screen.getByText(name)),
    };
  }

  test('a new routine can start with auto on, from the moment it is added', async () => {
    const { habit, click } = setup();
    await click('addAuto');
    expect(habit().auto).toEqual({ direction: 'plus', everyMinutes: 60, maxPerDay: 8, since: NOW, frozenThrough: '2026-10-05' });
  });

  test('a routine added without auto has it off', async () => {
    const { habit, click } = setup();
    await click('addPlain');
    expect(habit().auto).toBeNull();
  });

  test('editing settings saves what was earned so far; renaming leaves auto alone', async () => {
    const { habit, click } = setup();
    await click('addAuto');
    vi.setSystemTime(NOW + 3.5 * 3600 * 1000); // 12:30, 3 hours earned

    await click('rename');
    expect(habit().auto.since).toBe(NOW);

    await click('editAuto');
    expect(habit().log['2026-10-06']).toEqual({ plus: 0, minus: 0, autoPlus: 3 });
    expect(habit().auto).toMatchObject({ direction: 'minus', everyMinutes: 90, maxPerDay: 6 });

    await click('off');
    expect(habit().auto).toBeNull();
    expect(habit().log['2026-10-06'].autoPlus).toBe(3);
  });

  test('saved auto settings and tap times survive a reload; bad ones are dropped', () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 6, timers: [], notes: [], todos: [], embeds: [], journal: {},
      habits: [
        { id: 1, kind: 'routine', name: 'A', createdOn: '2026-10-01',
          auto: { direction: 'plus', everyMinutes: 2, maxPerDay: 999, since: NOW, frozenThrough: 'nope' },
          log: { '2026-10-06': { plus: 1, plusAt: [NOW, 'x', -5], autoPlus: 2.5, autoMinus: 3 } } },
        { id: 2, kind: 'routine', name: 'B', createdOn: '2026-10-01', auto: { direction: 'up' }, log: {} },
      ],
    }));
    const [a, b] = loadState(KEY, 'tue').habits;
    expect(a.auto).toEqual({ direction: 'plus', everyMinutes: 5, maxPerDay: 100, since: NOW, frozenThrough: null });
    expect(a.log['2026-10-06']).toEqual({ plus: 1, minus: 0, plusAt: [NOW], autoMinus: 3 });
    expect(b.auto).toBeNull();
  });
});

describe('backup round trip', () => {
  test('a backup restores to exactly the state it was made from', async () => {
    const { backupFromState, stateFromBackup } = await import('./store');
    const state = {
      version: STATE_VERSION, timers: [{ id: 1, day: 'mon', title: 'Focus', seconds: 60, secondsSpent: 10, initial: 60, reps: 2, repsOn: { '2026-10-05': 2 },
        pomodoro: { breakSeconds: 300, longBreakSeconds: 900, longEvery: 4, autoBreak: true } }],
      notes: [{ id: 2, day: 'tue', content: 'n' }], todos: [{ id: 3, day: 'wed', text: 't', doneOn: '2026-09-30' }],
      habits: [
        { id: 4, kind: 'daily', name: 'Pray', createdOn: '2026-09-01', target: 5, log: { '2026-10-01': 4 } },
        { id: 5, kind: 'routine', name: 'Urge', createdOn: '2026-09-01', log: { '2026-10-01': { plus: 1, minus: 0, plusAt: [1790000000000], autoPlus: 2 } },
          auto: { direction: 'plus', everyMinutes: 60, maxPerDay: 8, since: 1789000000000, frozenThrough: '2026-09-30' } },
      ],
      journal: { '2026-10-01': 'Dear diary' }, embeds: [],
      milestones: [
        { id: 6, title: 'Got the AWS certification', note: 'Second try', achievedOn: '2026-10-08', year: 2026, kept: false },
        { id: 7, title: 'Visit Japan', note: '', achievedOn: null, year: 2026, kept: false },
      ],
    };
    const file = JSON.stringify(backupFromState(state, new Date('2026-10-06T00:00:00Z')));
    expect(stateFromBackup(file, 'tue').state).toEqual(state);
  });
});
