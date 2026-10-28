import { useContext } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerItem from './TimerItem';
import { StoreProvider, store, STATE_VERSION } from '../redux/store';
import { mockViewportWidth } from '../test-utils/mockViewport';

const KEY = import.meta.env.VITE_STORAGEKEY;
const entry = (seconds, rounds) => ({ 'deep work': { title: 'Deep work', seconds, rounds } });

// Today is Wednesday 28 Oct 2026. "Deep work" is planned Mon to Fri.
function seed() {
  const timers = ['mon', 'tue', 'wed', 'thu', 'fri'].map((day, i) => ({
    id: i + 1, day, title: 'Deep work', seconds: 1500, secondsSpent: 0, initial: 1500, reps: 0, repsOn: {}, pomodoro: null,
  }));
  window.localStorage.setItem(KEY, JSON.stringify({
    version: STATE_VERSION, notes: [], todos: [], habits: [], journal: {}, embeds: [], milestones: [], timers,
    focus: {
      '2026-10-15': entry(1500, 1), // Thu, last week but one
      '2026-10-16': entry(1500, 1), // Fri
      '2026-10-19': entry(3000, 2), // Mon
      // Tue 20 to Thu 22: missed
      '2026-10-23': entry(1500, 1), // Fri
      '2026-10-25': entry(3000, 2), // Sun: an extra day
      '2026-10-26': entry(1500, 1), // Mon
      '2026-10-27': entry(6000, 4), // Tue
      '2026-10-28': entry(600, 0), // today: 10 min so far, no round yet
    },
  }));
}

function Live() {
  const { timers } = useContext(store);
  return <TimerItem timer={timers.find((t) => t.day === 'wed')} />;
}

let restoreViewport;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 28, 12, 0, 0));
  seed();
});
afterEach(() => {
  vi.useRealTimers();
  restoreViewport?.();
  restoreViewport = undefined;
});

async function openHistory() {
  const user = userEvent.setup();
  render(<StoreProvider><Live /></StoreProvider>);
  await user.click(screen.getByRole('button', { name: 'History' }));
  const dialog = await screen.findByRole('dialog', { name: 'Deep work history' });
  return { user, dialog };
}
const cell = (dialog, date) => dialog.querySelector(`[data-date="${date}"]`);

test('shows planned days, the streak and this week against last week', async () => {
  const { dialog } = await openHistory();

  expect(within(dialog).getByText('Planned Mon to Fri')).toBeInTheDocument();
  // Fri 23, Sun 25 (extra), Mon 26, Tue 27; today isn't done yet but doesn't break it.
  expect(within(dialog).getByText('4 days')).toBeInTheDocument();
  // This week: 25 + 100 + 10 min. Last week: 50 + 25 + 50 min.
  expect(within(dialog).getByText('2 h 15 min')).toBeInTheDocument();
  expect(within(dialog).getByText('+10 min vs last week')).toBeInTheDocument();
  // Planned days from Thu 15 to Tue 27 (today not done yet): 9, of which 6 done.
  expect(within(dialog).getByText('6 of 9')).toBeInTheDocument();
});

test('shades days by time, and tells missed days apart from unplanned ones', async () => {
  const { dialog } = await openHistory();

  expect(cell(dialog, '2026-10-27').dataset.level).toBe('l3'); // 1 h 40 min
  expect(cell(dialog, '2026-10-26').dataset.level).toBe('l1'); // 25 min
  expect(cell(dialog, '2026-10-21').dataset.level).toBe('l0'); // planned, missed
  expect(cell(dialog, '2026-10-24').dataset.level).toBe('off'); // Saturday, not planned
  expect(cell(dialog, '2026-10-25').dataset.level).toBe('l2'); // extra Sunday, 50 min
  expect(cell(dialog, '2026-10-01').dataset.level).toBe('off'); // before the history starts
  expect(cell(dialog, '2026-10-29')).toBeNull(); // the future isn't drawn
});

test('tapping a day shows its details, and arrow keys move between days', async () => {
  const { user, dialog } = await openHistory();
  const detail = within(dialog).getByTestId('history-detail');

  expect(detail).toHaveTextContent('Wed 28 Oct: 10 min focused, 0 rounds');
  await user.click(cell(dialog, '2026-10-25'));
  expect(detail).toHaveTextContent('Sun 25 Oct: 50 min focused, 2 rounds (extra day)');
  await user.click(cell(dialog, '2026-10-21'));
  expect(detail).toHaveTextContent('Wed 21 Oct: planned, nothing done');

  await user.keyboard('{ArrowDown}');
  expect(detail).toHaveTextContent('Thu 22 Oct: planned, nothing done');
  await user.keyboard('{ArrowRight}');
  expect(detail).toHaveTextContent('Thu 22 Oct'); // next week is the future: stays put
});

test('a phone shows 12 weeks, a computer a year', async () => {
  restoreViewport = mockViewportWidth(390);
  const { dialog } = await openHistory();
  // 12 weeks of 7 days, minus the 4 days after today.
  expect(dialog.querySelectorAll('[data-date]')).toHaveLength(12 * 7 - 4);
});
