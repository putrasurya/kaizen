import { screen, within } from '@testing-library/react';
import AppHabits from './AppHabits';
import { renderWithDay, pickDay } from '../test-utils/renderWithDay';

const KEY = import.meta.env.VITE_STORAGEKEY;

// Only Date is faked; userEvent and antd need real timers. 2026-10-02 is a
// Friday, in the Monday-first week 2026-09-28 .. 2026-10-04.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
});
afterEach(() => vi.useRealTimers());

function seed(habits) {
  window.localStorage.setItem(KEY, JSON.stringify({ version: 4, timers: [], notes: [], todos: [], embeds: [], habits }));
}

const saved = () => JSON.parse(window.localStorage.getItem(KEY)).habits;
const slot = (n, of = 5, name = 'Pray') => screen.getByRole('button', { name: `${name} ${n} of ${of}` });
const section = (name) => screen.getByRole('region', { name });

const pray = { id: 1, kind: 'daily', name: 'Pray', target: 5, log: {} };
const smoke = { id: 2, kind: 'routine', name: 'No smoking', log: {} };

test('both sections start empty and explain themselves', () => {
  renderWithDay(<AppHabits />);
  expect(within(section('Daily')).getByText(/praying 5 times/)).toBeInTheDocument();
  expect(within(section('Routines')).getByText(/debt you pay back/)).toBeInTheDocument();
});

test('adds a daily habit with a target, shown as that many empty slots', async () => {
  const user = renderWithDay(<AppHabits />);

  await user.click(screen.getByRole('button', { name: 'Add daily habit' }));
  const dialog = await screen.findByRole('dialog', { name: 'New daily habit' });
  await user.type(within(dialog).getByLabelText('Name'), 'Water');
  const target = within(dialog).getByLabelText('Times per day');
  await user.clear(target);
  await user.type(target, '3');
  await user.click(within(dialog).getByRole('button', { name: 'Add' }));

  expect(await screen.findByText('Water')).toBeInTheDocument();
  expect(within(section('Daily')).getAllByRole('button', { name: /^Water \d of 3$/ })).toHaveLength(3);
  expect(saved()).toMatchObject([{ kind: 'daily', name: 'Water', target: 3, log: {} }]);
});

test('tapping a slot fills up to it; tapping the last filled one empties it', async () => {
  seed([pray]);
  const user = renderWithDay(<AppHabits />);

  await user.click(slot(3));
  expect([1, 2, 3, 4, 5].map((n) => slot(n).getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'false', 'false']);
  expect(screen.getByText(/3\/5 today/)).toBeInTheDocument();
  expect(screen.getByTestId('week-1')).toHaveTextContent('3/35 this week');
  expect(saved()[0].log).toEqual({ '2026-10-02': 3 });

  await user.click(slot(3));
  expect(slot(3)).toHaveAttribute('aria-pressed', 'false');
  expect(saved()[0].log).toEqual({ '2026-10-02': 2 });
});

test('slots follow the day picker: earlier days can be filled in, later ones not yet', async () => {
  seed([pray]);
  const user = renderWithDay(<AppHabits />);

  await pickDay(user, 'Mon');
  expect(screen.getByText(/0\/5 on Monday/)).toBeInTheDocument();
  await user.click(slot(5));
  expect(saved()[0].log).toEqual({ '2026-09-28': 5 });

  await pickDay(user, 'Sat');
  expect(slot(1)).toBeDisabled();
  expect(screen.getByText(/Can't fill Saturday yet/)).toBeInTheDocument();
});

test('a routine slip is a debt that + taps pay back, with undo', async () => {
  seed([smoke]);
  const user = renderWithDay(<AppHabits />);
  const balance = () => screen.getByTestId('balance-2');
  expect(balance()).toHaveTextContent('Clear');

  await user.click(screen.getByRole('button', { name: 'Slipped on No smoking' }));
  await user.click(screen.getByRole('button', { name: 'Slipped on No smoking' }));
  expect(balance()).toHaveTextContent('Owe 2');

  for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Held on with No smoking' }));
  expect(balance()).toHaveTextContent('+1 ahead');

  await user.click(screen.getByRole('button', { name: 'Undo +1' }));
  expect(balance()).toHaveTextContent('Clear');
  expect(saved()[0].log).toEqual({ '2026-10-02': { plus: 2, minus: 2 } });
});

test("last week's debt doesn't carry into this week", () => {
  seed([{ ...smoke, log: { '2026-09-27': { plus: 0, minus: 5 }, '2026-09-29': { plus: 1, minus: 0 } } }]);
  renderWithDay(<AppHabits />);
  expect(screen.getByTestId('balance-2')).toHaveTextContent('+1 ahead');
});

test('history shows each week for both kinds', async () => {
  seed([
    { ...pray, log: { '2026-09-21': 5, '2026-09-22': 4, '2026-09-28': 5 } },
    { ...smoke, log: { '2026-09-23': { plus: 1, minus: 4 }, '2026-09-29': { plus: 2, minus: 0 } } },
  ]);
  const user = renderWithDay(<AppHabits />);

  await user.click(screen.getByRole('button', { name: 'History of Pray' }));
  let dialog = await screen.findByRole('dialog', { name: 'Pray: history' });
  const heat = within(dialog).getByRole('img', { name: /, last / });
  expect(heat).toHaveAccessibleName(expect.stringContaining('9 of 35'));
  expect(heat).toHaveAccessibleName(expect.stringContaining('5 of 35'));
  await user.click(within(dialog).getByRole('button', { name: 'Close' }));

  await user.click(screen.getByRole('button', { name: 'History of No smoking' }));
  dialog = await screen.findByRole('dialog', { name: 'No smoking: history' });
  const bars = within(dialog).getByRole('img', { name: /, last / });
  expect(bars).toHaveAccessibleName(expect.stringContaining('Owe 3'));
  expect(bars).toHaveAccessibleName(expect.stringContaining('+2 ahead'));
});

test('history starts from the week the habit was created', async () => {
  seed([{ ...pray, createdOn: '2026-09-23', log: { '2026-09-23': 2 } }]);
  const user = renderWithDay(<AppHabits />);

  await user.click(screen.getByRole('button', { name: 'History of Pray' }));
  const dialog = await screen.findByRole('dialog', { name: 'Pray: history' });
  expect(within(dialog).getByText('Sep 21')).toBeInTheDocument();
  expect(within(dialog).queryByText('Sep 14')).not.toBeInTheDocument();
  expect(within(dialog).getByRole('img', { name: /, last 2 weeks/ })).toBeInTheDocument();
});

test('deleting asks first, then removes the habit and its history', async () => {
  seed([pray, smoke]);
  const user = renderWithDay(<AppHabits />);

  await user.click(screen.getByRole('button', { name: 'Delete Pray' }));
  await user.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(screen.queryByText('Pray')).not.toBeInTheDocument();
  expect(saved()).toEqual([{ ...smoke, createdOn: '2026-10-02' }]);
});
