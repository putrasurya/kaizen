import { useContext } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import TimerItem from './TimerItem';
import TabTitle from './TabTitle';
import { StoreProvider, store, STATE_VERSION } from '../redux/store';
import { PrivacyProvider } from '../redux/privacy';

const KEY = import.meta.env.VITE_STORAGEKEY;
const DEFAULT = 'Kaizen: Your companion for continuous productivity.';

function Live() {
  const { timers } = useContext(store);
  return timers.map((t) => <TimerItem key={t.id} timer={t} />);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  vi.setSystemTime(new Date(2026, 10, 3, 9, 0, 0));
  document.title = DEFAULT;
  window.localStorage.setItem(KEY, JSON.stringify({
    version: STATE_VERSION,
    timers: [{ id: 1, day: 'tue', title: 'Deep work', seconds: 1500, secondsSpent: 0, initial: 1500, reps: 0, repsOn: {}, pomodoro: null }],
  }));
});
afterEach(() => vi.useRealTimers());

const run = (seconds) => act(() => vi.advanceTimersByTime(seconds * 1000));

test('the tab shows the countdown while a timer runs, and goes back after', () => {
  render(<StoreProvider><PrivacyProvider><Live /><TabTitle /></PrivacyProvider></StoreProvider>);
  expect(document.title).toBe(DEFAULT);

  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  expect(document.title).toBe('25:00 Deep work · Kaizen');
  run(47);
  expect(document.title).toBe('24:13 Deep work · Kaizen');

  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(document.title).toBe(DEFAULT);
});
