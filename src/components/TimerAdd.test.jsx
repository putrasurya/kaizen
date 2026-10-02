import { screen, within } from '@testing-library/react';
import AppTimer from './AppTimer';
import { renderWithDay } from '../test-utils/renderWithDay';

// AppTimer renders TimerAdd itself, so tests exercise TimerAdd through AppTimer
// rather than mounting it standalone (avoids duplicate "Add Timer" buttons and lets
// the "submit adds a timer" test assert against the resulting TimerItem).
function renderAppTimer() {
  return renderWithDay(<AppTimer />);
}

async function openDialog(user) {
  await user.click(screen.getByRole('button', { name: /add timer/i }));
  return screen.getByRole('dialog');
}

// The visually hidden live region that announces the selected duration.
function readout(dialog) {
  return within(dialog).getByRole('status');
}

// antd 6's Radio.Button gives the underlying <input> `pointer-events: none` (the
// wrapping <label> is the actual click target, styled to look like a button) —
// userEvent v14 refuses to click an element with pointer-events: none, so click the
// label instead of the radio input getByRole('radio', ...) resolves to.
async function clickPreset(user, dialog, name) {
  await user.click(within(dialog).getByRole('radio', { name }).closest('label'));
}

async function setStepper(user, dialog, name, value) {
  const input = within(dialog).getByRole('spinbutton', { name });
  await user.clear(input);
  await user.type(input, String(value));
}

test('the default duration is 1 hour, shown in the readout and the 1h chip', async () => {
  const user = renderAppTimer();
  const dialog = await openDialog(user);

  expect(readout(dialog)).toHaveTextContent('Duration: 1 hour');
  expect(within(dialog).getByText('1')).toBeInTheDocument();
  expect(within(dialog).getByText('h')).toBeInTheDocument();
  expect(within(dialog).getByRole('radio', { name: '1 hour' })).toBeChecked();
  expect(within(dialog).getByRole('spinbutton', { name: 'Hours' })).toHaveValue('1');
  expect(within(dialog).getByRole('spinbutton', { name: 'Minutes' })).toHaveValue('0');
});

test('picking a preset chip sets the duration and the steppers', async () => {
  const user = renderAppTimer();
  const dialog = await openDialog(user);

  await clickPreset(user, dialog, '25 minutes');

  expect(within(dialog).getByRole('radio', { name: '25 minutes' })).toBeChecked();
  expect(within(dialog).getByRole('radio', { name: '1 hour' })).not.toBeChecked();
  expect(readout(dialog)).toHaveTextContent('Duration: 25 minutes');
  expect(within(dialog).getByText('25')).toBeInTheDocument();
  expect(within(dialog).getByText('min')).toBeInTheDocument();
  expect(within(dialog).getByRole('spinbutton', { name: 'Hours' })).toHaveValue('0');
  expect(within(dialog).getByRole('spinbutton', { name: 'Minutes' })).toHaveValue('25');
});

test('typing a custom duration updates the readout and clears the chips', async () => {
  const user = renderAppTimer();
  const dialog = await openDialog(user);

  await setStepper(user, dialog, 'Hours', 2);
  await setStepper(user, dialog, 'Minutes', 20);

  expect(readout(dialog)).toHaveTextContent('Duration: 2 hours 20 minutes');
  expect(within(dialog).queryByRole('radio', { checked: true })).not.toBeInTheDocument();
});

test('submitting adds a timer with the chosen duration in seconds', async () => {
  const user = renderAppTimer();
  const dialog = await openDialog(user);

  await user.type(screen.getByPlaceholderText(/Focus on Works/i), 'Deep Work');
  // Leave hours at the 1h default; only set minutes to 20.
  await setStepper(user, dialog, 'Minutes', 20);
  await user.click(screen.getByRole('button', { name: 'OK' }));

  expect(await screen.findByText('Deep Work')).toBeInTheDocument();
  // 1h + 20m = 1h20m, shown both by AppTimer's "Times left" header and by the new
  // TimerItem's TimerCountdown, both formatted as "1.20".
  expect(screen.getAllByText(/1\.20/).length).toBeGreaterThan(0);
});

test('a zero duration cannot be submitted', async () => {
  const user = renderAppTimer();
  const dialog = await openDialog(user);

  await user.type(screen.getByPlaceholderText(/Focus on Works/i), 'Nothing');
  await setStepper(user, dialog, 'Hours', 0);

  expect(readout(dialog)).toHaveTextContent('Duration: 0 minutes');
  expect(await within(dialog).findByText('Choose a duration longer than 0 minutes')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'OK' }));

  // Still open, nothing added.
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(screen.queryByText('Nothing')).not.toBeInTheDocument();
  expect(screen.getByText('0.0 Times left')).toBeInTheDocument();
});

describe('selected day', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;

  // Fake only Date: userEvent and antd still need real timers. 2026-10-02 is a
  // Friday.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  test('the timer is added, with its chosen duration, to the day being viewed', async () => {
    const user = renderAppTimer();

    await user.click(screen.getByRole('radio', { name: /^Tue$/ }).closest('label'));
    const dialog = await openDialog(user);
    expect(within(dialog).getByText('Add Timer for Tuesday')).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText(/Focus on Works/i), 'Tuesday Pomodoro');
    await clickPreset(user, dialog, '25 minutes');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('Tuesday Pomodoro')).toBeVisible();
    const saved = JSON.parse(window.localStorage.getItem(KEY)).timers;
    expect(saved[0]).toMatchObject({
      title: 'Tuesday Pomodoro',
      day: 'tue',
      seconds: 25 * 60,
      initial: 25 * 60,
      secondsSpent: 0,
    });
  });
});
