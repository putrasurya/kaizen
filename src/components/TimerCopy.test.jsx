import { screen, waitFor, within } from '@testing-library/react';
import AppTimer from './AppTimer';
import { renderWithDay, pickDay } from '../test-utils/renderWithDay';

const KEY = import.meta.env.VITE_STORAGEKEY;

// 2026-10-02 is a Friday. Only Date is faked; userEvent and antd need real timers.
const focus = { id: 1, day: 'fri', title: 'Focus', seconds: 3600, initial: 3600, secondsSpent: 600, reps: 3 };

function seed(timers) {
  window.localStorage.setItem(KEY, JSON.stringify({ version: 2, notes: [], embeds: [], timers }));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
  seed([focus]);
});
afterEach(() => vi.useRealTimers());

function renderAppTimer() {
  return renderWithDay(<AppTimer />);
}

function savedTimers() {
  return JSON.parse(window.localStorage.getItem(KEY)).timers;
}

async function openCopyDialog(user) {
  // Role queries skip other days' (hidden) cards, so this is the viewed day's.
  await user.click(screen.getByRole('button', { name: 'copy' }));
  // Not findByRole('dialog', { name }): under test antd gives every dialog the
  // same aria-labelledby id, so a leftover confirm dialog can steal the name.
  const title = await screen.findByText('Copy "Focus" to');
  return title.closest('[role="dialog"]');
}

async function copyTo(user, dayNames) {
  const dialog = await openCopyDialog(user);
  for (const name of dayNames) {
    await user.click(within(dialog).getByRole('checkbox', { name }));
  }
  await user.click(within(dialog).getByRole('button', { name: 'Copy' }));
}

test('copies a timer to the chosen days as independent timers with fresh state', async () => {
  const user = renderAppTimer();

  await copyTo(user, ['Mon', 'Wed']);

  const timers = savedTimers();
  expect(timers).toHaveLength(3);
  expect(new Set(timers.map((t) => t.id)).size).toBe(3);
  const byDay = Object.fromEntries(timers.map((t) => [t.day, t]));
  // The original is untouched.
  expect(byDay.fri).toMatchObject({ id: 1, secondsSpent: 600, reps: 3 });
  // Copies: same settings, fresh runtime state.
  for (const day of ['mon', 'wed']) {
    expect(byDay[day]).toMatchObject({ title: 'Focus', seconds: 3600, initial: 3600, secondsSpent: 0, reps: 0 });
  }

  await pickDay(user, /^Mon$/);
  expect(screen.getByText('1.0 Times left')).toBeInTheDocument();
  // Fri's original shows 0.50 left; Mon's copy is full and not running.
  const visibleCountdowns = screen.getAllByText('1.00').filter((el) => el.closest('[hidden]') === null);
  expect(visibleCountdowns).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Start' })).toBeVisible();
});

test('deleting a copy leaves the original and other copies alone', async () => {
  const user = renderAppTimer();
  await copyTo(user, ['Mon', 'Tue']);

  await pickDay(user, /^Mon$/);
  await user.click(screen.getByRole('button', { name: 'Delete timer' }));
  // antd renders a Modal.confirm title twice; find the dialog via its confirm title.
  const confirmTitle = await waitFor(() => {
    const title = document.querySelector('.ant-modal-confirm-title');
    if (!title) throw new Error('no confirm dialog yet');
    return title;
  });
  const confirm = confirmTitle.closest('[role="dialog"]');
  await user.click(within(confirm).getByRole('button', { name: 'OK' }));

  const timers = savedTimers();
  expect(timers.map((t) => t.day).sort()).toEqual(['fri', 'tue']);
  expect(timers.find((t) => t.day === 'fri')).toMatchObject({ id: 1, reps: 3, secondsSpent: 600 });
});

test('the timer\'s own day and days that already have it are disabled (skipped)', async () => {
  seed([focus, { ...focus, id: 2, day: 'tue', secondsSpent: 0, reps: 0 }]);
  const user = renderAppTimer();

  const dialog = await openCopyDialog(user);
  expect(within(dialog).getByRole('checkbox', { name: 'Fri' })).toBeDisabled();
  expect(within(dialog).getByRole('checkbox', { name: 'Tue' })).toBeDisabled();
  expect(within(dialog).getByRole('checkbox', { name: 'Mon' })).toBeEnabled();
  // Nothing picked yet, so there's nothing to copy.
  expect(within(dialog).getByRole('button', { name: 'Copy' })).toBeDisabled();
});
