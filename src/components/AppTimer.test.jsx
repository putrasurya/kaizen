import { act, screen } from '@testing-library/react';
import AppTimer from './AppTimer';
import { renderWithDay, dayRadio, pickDay } from '../test-utils/renderWithDay';

function renderAppTimer() {
  return renderWithDay(<AppTimer />);
}

async function addTimer(user, title) {
  await user.click(screen.getByRole('button', { name: /add timer/i }));
  await user.type(screen.getByRole('textbox', { name: 'Title' }), title);
  await user.click(screen.getByRole('button', { name: 'Add' }));
}

test('renders the Timers heading and an Add Timer control with no timers', () => {
  renderAppTimer();

  expect(screen.getByRole('heading', { name: 'Timers' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add timer/i })).toBeInTheDocument();
  expect(screen.getByText('0.0 Times left')).toBeInTheDocument();
});

test('renders one TimerItem per added timer and sums totalHour across them', async () => {
  const user = renderAppTimer();

  await addTimer(user, 'Deep Work');
  expect(await screen.findByText('Deep Work')).toBeInTheDocument();
  // Default TimerAdd duration = 1h.
  expect(screen.getByText('1.0 Times left')).toBeInTheDocument();

  await addTimer(user, 'Reading');
  expect(await screen.findByText('Reading')).toBeInTheDocument();
  // Two 1h timers = 2h total.
  expect(screen.getByText('2.0 Times left')).toBeInTheDocument();
});

describe('day view', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;

  // Fake only Date: userEvent and antd still need real timers. 2026-10-02 is a
  // Friday.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
  });
  afterEach(() => vi.useRealTimers());

  function seed(timers) {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({
        version: 2,
        notes: [],
        embeds: [],
        timers: timers.map((t, i) => ({
          id: i + 1,
          seconds: 3600,
          initial: 3600,
          secondsSpent: 0,
          reps: 0,
          ...t,
        })),
      })
    );
  }

  test('shows only today\'s timers by default, with today selected and marked', () => {
    seed([
      { day: 'fri', title: 'Friday Focus' },
      { day: 'mon', title: 'Monday Gym' },
    ]);
    renderAppTimer();

    expect(dayRadio(/^Fri\s?\(today\)$/)).toBeChecked();
    expect(dayRadio(/^Mon$/)).not.toBeChecked();
    expect(screen.getByText('Friday Focus')).toBeVisible();
    expect(screen.getByText('Monday Gym')).not.toBeVisible();
    // Total only counts the viewed day's timers.
    expect(screen.getByText('1.0 Times left')).toBeInTheDocument();
  });

  test('switching days shows that day\'s timers', async () => {
    seed([
      { day: 'fri', title: 'Friday Focus' },
      { day: 'mon', title: 'Monday Gym', seconds: 1800, initial: 1800 },
    ]);
    const user = renderAppTimer();

    await pickDay(user, /^Mon$/);

    expect(dayRadio(/^Mon$/)).toBeChecked();
    expect(screen.getByText('Monday Gym')).toBeVisible();
    expect(screen.getByText('Friday Focus')).not.toBeVisible();
    expect(screen.getByText('0.30 Times left')).toBeInTheDocument();
    // Today stays marked while another day is viewed.
    expect(dayRadio(/^Fri\s?\(today\)$/)).not.toBeChecked();
  });

  test('a timer added while viewing a day belongs to that day', async () => {
    const user = renderAppTimer();

    await pickDay(user, /^Tue$/);
    await addTimer(user, 'Tuesday Reading');

    expect(await screen.findByText('Tuesday Reading')).toBeVisible();
    const saved = JSON.parse(window.localStorage.getItem(KEY)).timers;
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ title: 'Tuesday Reading', day: 'tue' });

    await pickDay(user, /^Fri\s?\(today\)$/);
    expect(screen.getByText('Tuesday Reading')).not.toBeVisible();
  });

  test('goes back to today when the date changes', async () => {
    seed([{ day: 'sat', title: 'Saturday Run' }]);
    const user = renderAppTimer();
    await pickDay(user, /^Mon$/);

    vi.setSystemTime(new Date(2026, 9, 3, 0, 0, 5));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(dayRadio(/^Sat\s?\(today\)$/)).toBeChecked();
    expect(screen.getByText('Saturday Run')).toBeVisible();
  });

  test('a running timer keeps running while its day is hidden, and its day is flagged', async () => {
    seed([
      { day: 'fri', title: 'Friday Focus' },
      { day: 'mon', title: 'Monday Gym' },
    ]);
    const user = renderAppTimer();

    await user.click(screen.getByRole('button', { name: 'Start' }));
    await pickDay(user, /^Mon$/);

    // Hidden, not unmounted: the countdown is still in its playing state.
    expect(screen.getByText('Friday Focus')).not.toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Pause', hidden: true })).toHaveLength(1);
    expect(dayRadio(/^Fri\s?\(today\),\s?timer running$/)).toBeInTheDocument();

    await pickDay(user, /^Fri/);
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
  });
});
