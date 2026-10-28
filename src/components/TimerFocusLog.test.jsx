import { useContext } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TimerItem from './TimerItem';
import { StoreProvider, store, STATE_VERSION } from '../redux/store';

// What a timer writes to the focus log: real focused time and finished rounds,
// never break time, and never the same seconds twice.
const KEY = import.meta.env.VITE_STORAGEKEY;
const T0 = new Date(2026, 9, 28, 9, 0, 0).getTime(); // Wednesday
const POMODORO = { breakSeconds: 5 * 60, longBreakSeconds: 15 * 60, longEvery: 4, autoBreak: true };

function seed(timer = {}) {
  window.localStorage.setItem(KEY, JSON.stringify({
    version: STATE_VERSION, notes: [], todos: [], habits: [], journal: {}, embeds: [], milestones: [], focus: {},
    timers: [{ id: 1, day: 'wed', title: 'Deep work', seconds: 25 * 60, secondsSpent: 0, initial: 25 * 60, reps: 0, repsOn: {}, pomodoro: null, ...timer }],
  }));
}
const logged = () => JSON.parse(window.localStorage.getItem(KEY)).focus['2026-10-28']?.['deep work'];

function Live() {
  const { timers } = useContext(store);
  return <TimerItem timer={timers[0]} />;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(T0);
});
afterEach(() => vi.useRealTimers());

const press = (name) => fireEvent.click(screen.getByRole('button', { name }));
const run = (seconds) => act(() => vi.advanceTimersByTime(seconds * 1000 + 50));

test('pausing logs the time focused so far; finishing logs the rest and a round', () => {
  seed();
  render(<StoreProvider><Live /></StoreProvider>);

  press('Start');
  run(10 * 60);
  press('Pause');
  expect(logged()).toEqual({ title: 'Deep work', seconds: 600, rounds: 0 });

  press('Start');
  run(15 * 60);
  expect(logged()).toEqual({ title: 'Deep work', seconds: 1500, rounds: 1 });
});

test('saves while running (every minute) are not counted twice at the finish', () => {
  seed({ seconds: 5 * 60, initial: 5 * 60 });
  render(<StoreProvider><Live /></StoreProvider>);

  press('Start');
  run(3 * 60);
  expect(logged().seconds).toBeGreaterThanOrEqual(60);
  run(2 * 60);
  expect(logged()).toEqual({ title: 'Deep work', seconds: 300, rounds: 1 });
});

test('break time is not logged', () => {
  seed({ seconds: 60, initial: 60, pomodoro: POMODORO });
  render(<StoreProvider><Live /></StoreProvider>);

  press('Start');
  run(60);
  run(5 * 60); // the whole break
  expect(logged()).toEqual({ title: 'Deep work', seconds: 60, rounds: 1 });
});

test('starting a round over keeps the time already focused, and counts on from zero', async () => {
  seed();
  render(<StoreProvider><Live /></StoreProvider>);

  press('Start');
  run(5 * 60);
  press('Pause');
  press('Start this round over');
  // Confirm dialog's OK.
  const ok = await vi.waitFor(() => {
    const buttons = Array.from(document.querySelectorAll('.ant-modal-confirm .ant-btn-primary'));
    if (!buttons.length) throw new Error('no dialog yet');
    return buttons[buttons.length - 1];
  });
  fireEvent.click(ok);

  press('Start');
  run(2 * 60);
  press('Pause');
  expect(logged()).toEqual({ title: 'Deep work', seconds: 420, rounds: 0 });
});
