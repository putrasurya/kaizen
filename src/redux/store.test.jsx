import { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { store, StoreProvider, loadState, STATE_VERSION } from './store';
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
      <button onClick={() => timer && ctx.resetReps(timer.id)}>resetReps</button>
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

  test('incrementReps and resetReps update the reps counter', async () => {
    const user = renderHarness();

    await user.click(screen.getByText('addTimer'));
    await user.click(screen.getByText('incrementReps'));
    await user.click(screen.getByText('incrementReps'));
    expect(readState()).toContain('"reps":2');

    await user.click(screen.getByText('resetReps'));
    expect(readState()).toContain('"reps":0');
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
    expect(state.notes).toEqual(legacy.notes);
    expect(state.embeds).toEqual(legacy.embeds);
    expect(state.timers).toHaveLength(14);
    expect(new Set(state.timers.map((t) => t.id)).size).toBe(14);
    for (const day of DAYS) {
      expect(state.timers.filter((t) => t.day === day).map((t) => t.title)).toEqual(['Deep Work', 'Reading']);
    }
    // Today's copy is the original record, progress and all...
    expect(state.timers.find((t) => t.day === 'wed' && t.title === 'Deep Work'))
      .toEqual({ ...legacy.timers[0], day: 'wed' });
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
    expect(loadState(KEY, 'mon')).toEqual({ version: STATE_VERSION, timers: [], notes: [], embeds: [] });
  });

  test('unparseable storage does not crash and is backed up instead of lost', () => {
    window.localStorage.setItem(KEY, '{"timers": [oops');

    expect(loadState(KEY, 'mon')).toEqual({ version: STATE_VERSION, timers: [], notes: [], embeds: [] });
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
    expect(state.embeds).toEqual([]);
    expect(state.timers).toHaveLength(2);
    // No day on current-version data: shown today rather than lost.
    expect(state.timers[0]).toMatchObject({ id: 5, day: 'thu', seconds: 600, secondsSpent: 600, initial: 600, reps: 0 });
    expect(state.timers[1]).toMatchObject({ title: 'Duplicate id', day: 'tue', seconds: 0 });
    expect(state.timers[1].id).not.toBe(5);
  });
});
