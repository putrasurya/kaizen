import { useContext } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TimerItem from './TimerItem';
import { StoreProvider, store, STATE_VERSION } from '../redux/store';

const KEY = import.meta.env.VITE_STORAGEKEY;
const T0 = new Date(2026, 9, 10, 9, 0, 0).getTime(); // Saturday
const POMODORO = { breakSeconds: 5 * 60, longBreakSeconds: 15 * 60, longEvery: 4, autoBreak: true };

function seed(timer) {
  window.localStorage.setItem(KEY, JSON.stringify({
    version: STATE_VERSION, notes: [], todos: [], habits: [], journal: {}, embeds: [], milestones: [],
    timers: [{ id: 1, day: 'sat', title: 'Deep work', seconds: 25 * 60, secondsSpent: 0, initial: 25 * 60, reps: 0, repsOn: {}, pomodoro: null, ...timer }],
  }));
}
const saved = () => JSON.parse(window.localStorage.getItem(KEY)).timers[0];

function Live() {
  const { timers } = useContext(store);
  return <TimerItem timer={timers[0]} />;
}

// Time only moves when the test moves it.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(T0);
  window.HTMLMediaElement.prototype.play.mockClear();
});
afterEach(() => vi.useRealTimers());

const press = (name) => fireEvent.click(screen.getByRole('button', { name }));
const run = (seconds) => act(() => vi.advanceTimersByTime(seconds * 1000 + 50));
const shown = () => screen.getByRole('heading', { level: 3 }).textContent;
const phase = () => screen.getByTestId('phase-1').textContent;

describe('without Pomodoro', () => {
  test('finishing buzzes, adds a rep for today, and goes back to full time, ready to play again', () => {
    seed({ seconds: 60, initial: 60 });
    render(<StoreProvider><Live /></StoreProvider>);

    press('Start');
    run(60);

    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalled();
    expect(saved()).toMatchObject({ reps: 1, repsOn: { '2026-10-10': 1 }, secondsSpent: 0 });
    expect(shown()).toBe('0.01.00');
    expect(screen.getByRole('button', { name: 'Start' })).toBeEnabled();
    expect(screen.getByTestId('reps-1')).toHaveTextContent('1 rep today · 1 min');
    expect(screen.queryByTestId('phase-1')).not.toBeInTheDocument();

    press('Start');
    run(60);
    expect(saved()).toMatchObject({ reps: 2, repsOn: { '2026-10-10': 2 } });
  });
});

describe('with Pomodoro', () => {
  test('a finished round starts the break by itself, and the break ends ready for the next round', () => {
    seed({ pomodoro: POMODORO });
    render(<StoreProvider><Live /></StoreProvider>);
    expect(phase()).toBe('Ready');

    press('Start');
    expect(phase()).toBe('Focus');
    window.HTMLMediaElement.prototype.play.mockClear(); // the muted unlock on the first tap
    run(25 * 60);

    expect(phase()).toBe('Break');
    expect(saved()).toMatchObject({ reps: 1, secondsSpent: 0 });
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    run(60);
    expect(shown()).toBe('0.04.00');
    expect(screen.getByRole('img', { name: '1 of 4 rounds before the long break' })).toBeInTheDocument();

    run(4 * 60);
    expect(phase()).toBe('Ready');
    expect(shown()).toBe('0.25.00');
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
    expect(window.HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(2); // end of round, end of break
  });

  test('every 4th round is followed by the long break', () => {
    seed({ pomodoro: POMODORO, reps: 3, repsOn: { '2026-10-10': 3 } });
    render(<StoreProvider><Live /></StoreProvider>);

    press('Start');
    run(25 * 60);
    expect(phase()).toBe('Long break');
    expect(shown()).toBe('0.15.00');
    expect(screen.getByRole('img', { name: '4 of 4 rounds before the long break' })).toBeInTheDocument();
    expect(screen.getByTestId('reps-1')).toHaveTextContent('4 🍅 today · 1 h 40 min focused');
  });

  test('with automatic breaks off, the break waits for play', () => {
    seed({ pomodoro: { ...POMODORO, autoBreak: false } });
    render(<StoreProvider><Live /></StoreProvider>);

    press('Start');
    run(25 * 60);
    expect(phase()).toBe('Break');
    run(60);
    expect(shown()).toBe('0.05.00');

    press('Start break');
    run(60);
    expect(shown()).toBe('0.04.00');
  });

  test('a break can be skipped', () => {
    seed({ pomodoro: POMODORO });
    render(<StoreProvider><Live /></StoreProvider>);
    press('Start');
    run(25 * 60);

    fireEvent.click(screen.getByText('Skip break'));
    expect(phase()).toBe('Ready');
    expect(shown()).toBe('0.25.00');
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument();
  });

  test('starting a round over keeps the reps', () => {
    seed({ pomodoro: POMODORO, reps: 2, repsOn: { '2026-10-10': 2 }, secondsSpent: 300 });
    render(<StoreProvider><Live /></StoreProvider>);
    expect(shown()).toBe('0.20.00');
    expect(screen.queryByText(/reset/i)).not.toBeInTheDocument();
  });
});

describe('editing a timer', () => {
  beforeEach(() => vi.useRealTimers());

  test('can rename it and switch Pomodoro on, with the classic settings to start from', async () => {
    seed({});
    const user = userEvent.setup();
    render(<StoreProvider><Live /></StoreProvider>);

    await user.click(screen.getByRole('button', { name: 'Edit timer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit timer' });
    const title = within(dialog).getByRole('textbox', { name: 'Title' });
    await user.clear(title);
    await user.type(title, 'Study');
    await user.click(within(dialog).getByRole('switch', { name: 'Pomodoro breaks' }));
    expect(within(dialog).getByRole('spinbutton', { name: 'Short break' })).toHaveValue('5');
    expect(within(dialog).getByRole('spinbutton', { name: 'Long break' })).toHaveValue('15');
    expect(within(dialog).getByRole('spinbutton', { name: 'Long break every' })).toHaveValue('4');
    expect(within(dialog).getByRole('switch', { name: 'Start breaks automatically' })).toBeChecked();
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved()).toMatchObject({ title: 'Study', pomodoro: POMODORO }));
    expect(screen.getByText('Study')).toBeInTheDocument();
    expect(screen.getByTestId('phase-1')).toHaveTextContent('Ready');
  });

  test('switching Pomodoro off removes the breaks', async () => {
    seed({ pomodoro: POMODORO });
    const user = userEvent.setup();
    render(<StoreProvider><Live /></StoreProvider>);

    await user.click(screen.getByRole('button', { name: 'Edit timer' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit timer' });
    await user.click(within(dialog).getByRole('switch', { name: 'Pomodoro breaks' }));
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(saved().pomodoro).toBeNull());
    expect(screen.queryByTestId('phase-1')).not.toBeInTheDocument();
  });
});
