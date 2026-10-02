import { useContext } from 'react';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerItem from './TimerItem';
import { store, StoreProvider } from '../redux/store';
import { mockViewportWidth } from '../test-utils/mockViewport';

// antd 6's Modal.confirm renders its title text in two places (an accessible
// header `.ant-modal-title` and the visual `.ant-modal-confirm-title`), so a plain
// text query is ambiguous — scope to the confirm-specific class. A stale,
// not-yet-removed dialog from an earlier test can also briefly coexist under jsdom
// (see setupTests.js), so take the most recently rendered match rather than
// assuming there's only one.
async function findConfirmDialog(regex) {
  let title;
  await waitFor(() => {
    const candidates = Array.from(document.querySelectorAll('.ant-modal-confirm-title')).filter((el) =>
      regex.test(el.textContent)
    );
    if (!candidates.length) throw new Error(`No confirm dialog matching ${regex} yet`);
    title = candidates[candidates.length - 1];
  });
  return title.closest('[role="dialog"]');
}

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

  const dialog = await findConfirmDialog(/delete timer\?/i);

  await user.click(within(dialog).getByRole('button', { name: 'OK' }));

  // Modal.confirm's onOk dispatches deleteTimer synchronously.
  expect(screen.queryByText('Focus on Works')).not.toBeInTheDocument();
});

test('confirming reset zeroes secondsSpent', async () => {
  const user = await renderTimerItem({ secondsSpent: 600 });

  await user.click(screen.getByRole('button', { name: 'undo' }));

  const dialog = await findConfirmDialog(/reset timer\?/i);

  await user.click(within(dialog).getByRole('button', { name: 'OK' }));

  // 1h (3600s) with nothing spent shows as "1.00" on the countdown.
  expect(await screen.findByText('1.00')).toBeInTheDocument();
});

describe('responsive layout', () => {
  let restoreViewport;
  afterEach(() => restoreViewport?.());

  test('uses large touch-sized controls on a phone-width viewport', async () => {
    restoreViewport = mockViewportWidth(375);
    await renderTimerItem();

    for (const name of ['play-circle', 'undo', 'delete']) {
      expect(screen.getByRole('button', { name })).toHaveClass('ant-btn-lg');
    }
    // Title and controls are allowed to wrap onto separate lines.
    expect(screen.getByText('Focus on Works').closest('.ant-row')).not.toHaveClass('ant-row-no-wrap');
  });

  test('keeps the compact single-line desktop layout on wide viewports', async () => {
    restoreViewport = mockViewportWidth(1280);
    await renderTimerItem();

    for (const name of ['play-circle', 'undo', 'delete']) {
      expect(screen.getByRole('button', { name })).not.toHaveClass('ant-btn-lg');
    }
    expect(screen.getByText('Focus on Works').closest('.ant-row')).toHaveClass('ant-row-no-wrap');
  });
});
