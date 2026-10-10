import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useContext } from 'react';
import TimerItemReps, { formatDuration } from './TimerItemReps';
import { store, StoreProvider } from '../redux/store';

// Saturday 2026-10-10.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 9, 0));
});
afterEach(() => vi.useRealTimers());

function Harness({ initial, pomodoro = null }) {
  const ctx = useContext(store);
  const timer = ctx.timers[0];

  return (
    <div>
      <button onClick={() => ctx.addTimer('Focus', initial, 0, false, 'sat', pomodoro)}>addTimer</button>
      {timer && <button onClick={() => ctx.incrementReps(timer.id)}>incrementReps</button>}
      {timer && <button onClick={() => ctx.incrementReps(timer.id, '2026-10-09')}>repYesterday</button>}
      {timer && <TimerItemReps timer={timer} />}
    </div>
  );
}

function renderHarness(props) {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <Harness initial={90} {...props} />
    </StoreProvider>
  );
  return user;
}

test('counts today\'s reps and the time they add up to', async () => {
  const user = renderHarness();
  await user.click(screen.getByText('addTimer'));
  expect(screen.getByText('0 reps today')).toBeInTheDocument();

  for (let i = 0; i < 3; i++) await user.click(screen.getByText('incrementReps'));
  // 90 s × 3 = 270 s
  expect(screen.getByText('3 reps today · 4 min')).toBeInTheDocument();
});

test('reps from another day don\'t count today, but count towards the total', async () => {
  const user = renderHarness();
  await user.click(screen.getByText('addTimer'));
  await user.click(screen.getByText('repYesterday'));
  await user.click(screen.getByText('incrementReps'));

  expect(screen.getByText('1 rep today · 1 min')).toBeInTheDocument();
  const saved = JSON.parse(window.localStorage.getItem(import.meta.env.VITE_STORAGEKEY)).timers[0];
  expect(saved).toMatchObject({ reps: 2, repsOn: { '2026-10-09': 1, '2026-10-10': 1 } });
});

test('Pomodoro timers count rounds as tomatoes and focused time', async () => {
  const user = renderHarness({ initial: 25 * 60, pomodoro: { breakSeconds: 300 } });
  await user.click(screen.getByText('addTimer'));
  for (let i = 0; i < 4; i++) await user.click(screen.getByText('incrementReps'));
  expect(screen.getByText('4 🍅 today · 1 h 40 min focused')).toBeInTheDocument();
});

test('there is no way to reset reps', async () => {
  const user = renderHarness();
  await user.click(screen.getByText('addTimer'));
  await user.click(screen.getByText('incrementReps'));
  expect(screen.queryByText(/reset/i)).not.toBeInTheDocument();
});

test.each([
  [45, '45 s'],
  [300, '5 min'],
  [3600, '1 h'],
  [6000, '1 h 40 min'],
])('formatDuration(%i) is "%s"', (seconds, text) => {
  expect(formatDuration(seconds)).toBe(text);
});
