import { useContext } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerItem from './TimerItem';
import { store, StoreProvider } from '../redux/store';

// Mirrors how AppTimer actually uses TimerItem: mapped from context state, not a
// static prop. This makes delete/reset (which dispatch through context) actually
// observable, since TimerItem re-renders from the timers array shrinking/changing.
function Harness({ seconds = 3600, secondsSpent = 0 }) {
  const ctx = useContext(store);
  const timer = ctx.timers[0];

  return (
    <div>
      <button onClick={() => ctx.addTimer('Focus on Works', seconds, secondsSpent)}>seed</button>
      {timer && <TimerItem timer={timer} />}
    </div>
  );
}

function renderTimerItem(overrides = {}) {
  render(
    <StoreProvider>
      <Harness {...overrides} />
    </StoreProvider>
  );
  userEvent.click(screen.getByText('seed'));
}

test('shows the timer title', () => {
  renderTimerItem();
  expect(screen.getByText('Focus on Works')).toBeInTheDocument();
});

test('play button toggles to pause and back', () => {
  renderTimerItem();

  const playButton = screen.getByRole('button', { name: 'play-circle' });
  userEvent.click(playButton);
  expect(screen.getByRole('button', { name: 'pause-circle' })).toBeInTheDocument();

  userEvent.click(screen.getByRole('button', { name: 'pause-circle' }));
  expect(screen.getByRole('button', { name: 'play-circle' })).toBeInTheDocument();
});

test('play button is disabled once the timer is fully spent', () => {
  renderTimerItem({ seconds: 60, secondsSpent: 60 });
  expect(screen.getByRole('button', { name: 'play-circle' })).toBeDisabled();
});

test('reset/delete buttons are disabled while playing', () => {
  renderTimerItem();

  userEvent.click(screen.getByRole('button', { name: 'play-circle' }));

  expect(screen.getByRole('button', { name: 'undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'delete' })).toBeDisabled();
});

test('confirming delete removes the timer via Modal.confirm', async () => {
  renderTimerItem();

  userEvent.click(screen.getByRole('button', { name: 'delete' }));

  // A stale, not-yet-removed confirm dialog from an earlier test can briefly
  // coexist under jsdom (see setupTests.js), so locate this dialog by its title
  // text rather than assuming it's the only role="dialog" element present.
  const title = await screen.findByText(/delete timer\?/i);
  const dialog = title.closest('[role="dialog"]');

  userEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

  // Modal.confirm's onOk dispatches deleteTimer synchronously.
  expect(screen.queryByText('Focus on Works')).not.toBeInTheDocument();
});

test('confirming reset zeroes secondsSpent', async () => {
  renderTimerItem({ secondsSpent: 600 });

  userEvent.click(screen.getByRole('button', { name: 'undo' }));

  const title = await screen.findByText(/reset timer\?/i);
  const dialog = title.closest('[role="dialog"]');

  userEvent.click(within(dialog).getByRole('button', { name: 'OK' }));

  // 1h (3600s) with nothing spent shows as "1.00" on the countdown.
  expect(await screen.findByText('1.00')).toBeInTheDocument();
});
