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

async function renderTimerItem(overrides = {}) {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <Harness {...overrides} />
    </StoreProvider>
  );
  await user.click(screen.getByText('seed'));
  return user;
}

test('shows the timer title', async () => {
  await renderTimerItem();
  expect(screen.getByText('Focus on Works')).toBeInTheDocument();
});

test('play button toggles to pause and back', async () => {
  const user = await renderTimerItem();

  const playButton = screen.getByRole('button', { name: 'play-circle' });
  await user.click(playButton);
  expect(screen.getByRole('button', { name: 'pause-circle' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'pause-circle' }));
  expect(screen.getByRole('button', { name: 'play-circle' })).toBeInTheDocument();
});

test('play button is disabled once the timer is fully spent', async () => {
  await renderTimerItem({ seconds: 60, secondsSpent: 60 });
  expect(screen.getByRole('button', { name: 'play-circle' })).toBeDisabled();
});

test('reset/delete buttons are disabled while playing', async () => {
  const user = await renderTimerItem();

  await user.click(screen.getByRole('button', { name: 'play-circle' }));

  expect(screen.getByRole('button', { name: 'undo' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'delete' })).toBeDisabled();
});

test('confirming delete removes the timer via Modal.confirm', async () => {
  const user = await renderTimerItem();

  await user.click(screen.getByRole('button', { name: 'delete' }));

  // A stale, not-yet-removed confirm dialog from an earlier test can briefly
  // coexist under jsdom (see setupTests.js), so locate this dialog by its title
  // text rather than assuming it's the only role="dialog" element present.
  const title = await screen.findByText(/delete timer\?/i);
  const dialog = title.closest('[role="dialog"]');

  await user.click(within(dialog).getByRole('button', { name: 'OK' }));

  // Modal.confirm's onOk dispatches deleteTimer synchronously.
  expect(screen.queryByText('Focus on Works')).not.toBeInTheDocument();
});

test('confirming reset zeroes secondsSpent', async () => {
  const user = await renderTimerItem({ secondsSpent: 600 });

  await user.click(screen.getByRole('button', { name: 'undo' }));

  const title = await screen.findByText(/reset timer\?/i);
  const dialog = title.closest('[role="dialog"]');

  await user.click(within(dialog).getByRole('button', { name: 'OK' }));

  // 1h (3600s) with nothing spent shows as "1.00" on the countdown.
  expect(await screen.findByText('1.00')).toBeInTheDocument();
});
