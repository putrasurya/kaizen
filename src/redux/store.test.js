import { useContext } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { store, StoreProvider } from './store';

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
  return render(
    <StoreProvider>
      <Harness />
    </StoreProvider>
  );
}

function readState() {
  return screen.getByTestId('state').textContent;
}

function readPersistedState() {
  return JSON.parse(window.localStorage.getItem(process.env.REACT_APP_STORAGEKEY));
}

describe('store reducer (via StoreProvider)', () => {
  test('addTimer adds a timer with initial reps/secondsSpent and persists it', () => {
    renderHarness();

    userEvent.click(screen.getByText('addTimer'));

    expect(readState()).toContain('"title":"Focus"');
    expect(readState()).toContain('"seconds":3600');
    expect(readState()).toContain('"reps":0');
    expect(readPersistedState().timers[0]).toMatchObject({ title: 'Focus', seconds: 3600, reps: 0 });
  });

  test('updateSecondsSpent updates the matching timer only', () => {
    renderHarness();

    userEvent.click(screen.getByText('addTimer'));
    userEvent.click(screen.getByText('updateSecondsSpent'));

    expect(readState()).toContain('"secondsSpent":120');
    expect(readPersistedState().timers[0].secondsSpent).toBe(120);
  });

  test('incrementReps and resetReps update the reps counter', () => {
    renderHarness();

    userEvent.click(screen.getByText('addTimer'));
    userEvent.click(screen.getByText('incrementReps'));
    userEvent.click(screen.getByText('incrementReps'));
    expect(readState()).toContain('"reps":2');

    userEvent.click(screen.getByText('resetReps'));
    expect(readState()).toContain('"reps":0');
  });

  test('deleteTimer removes the timer', () => {
    renderHarness();

    userEvent.click(screen.getByText('addTimer'));
    expect(readState()).toContain('"title":"Focus"');

    userEvent.click(screen.getByText('deleteTimer'));
    expect(readPersistedState().timers).toEqual([]);
  });

  test('addNote and deleteNote', () => {
    renderHarness();

    userEvent.click(screen.getByText('addNote'));
    expect(readState()).toContain('remember this');
    expect(readPersistedState().notes[0]).toMatchObject({ content: 'remember this' });

    userEvent.click(screen.getByText('deleteNote'));
    expect(readPersistedState().notes).toEqual([]);
  });

  test('addEmbed and deleteEmbed', () => {
    renderHarness();

    userEvent.click(screen.getByText('addEmbed'));
    expect(readState()).toContain('abc123');
    expect(readPersistedState().embeds[0]).toMatchObject({ link: 'abc123' });

    userEvent.click(screen.getByText('deleteEmbed'));
    expect(readPersistedState().embeds).toEqual([]);
  });
});
