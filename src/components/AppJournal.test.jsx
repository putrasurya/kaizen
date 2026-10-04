import { act, fireEvent, screen, within } from '@testing-library/react';
import AppJournal from './AppJournal';
import { renderWithDay, pickDay } from '../test-utils/renderWithDay';

const KEY = import.meta.env.VITE_STORAGEKEY;

// Only Date is faked; userEvent and antd need real timers. 2026-10-02 is a
// Friday, in the Monday-first week 2026-09-28 .. 2026-10-04.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
});
afterEach(() => vi.useRealTimers());

function seed({ journal = {}, habits = [] } = {}) {
  window.localStorage.setItem(
    KEY,
    JSON.stringify({ version: 5, timers: [], notes: [], todos: [], embeds: [], habits, journal })
  );
}

const saved = () => JSON.parse(window.localStorage.getItem(KEY))?.journal;
const editor = () => screen.getByRole('textbox', { name: /^Journal for / });
const pastButton = () => screen.getByRole('button', { name: /Past entries/ });

test('writes today\'s entry and saves it after a pause, without a save button', async () => {
  const user = renderWithDay(<AppJournal />);
  expect(editor()).toHaveAccessibleName(expect.stringContaining('Friday'));

  await user.type(editor(), 'Good day.');
  expect(await screen.findByText('Saved', {}, { timeout: 2000 })).toBeInTheDocument();
  expect(saved()).toEqual({ '2026-10-02': 'Good day.' });
});

test('leaving the field saves straight away', async () => {
  const user = renderWithDay(<AppJournal />);
  await user.type(editor(), 'quick');
  fireEvent.blur(editor());
  expect(saved()).toEqual({ '2026-10-02': 'quick' });
});

test('each date has its own entry; switching days saves what was pending', async () => {
  seed({ journal: { '2026-09-28': 'Monday thoughts' } });
  const user = renderWithDay(<AppJournal />);

  await user.type(editor(), 'Friday');
  await pickDay(user, 'Mon');
  expect(editor()).toHaveValue('Monday thoughts');
  expect(saved()).toEqual({ '2026-09-28': 'Monday thoughts', '2026-10-02': 'Friday' });

  await pickDay(user, /^Fri\s?\(today\)$/);
  expect(editor()).toHaveValue('Friday');
});

test('clearing an entry removes it', async () => {
  seed({ journal: { '2026-10-02': 'oops' } });
  const user = renderWithDay(<AppJournal />);
  await user.clear(editor());
  fireEvent.blur(editor());
  expect(saved()).toEqual({});
});

test('later days this week can\'t be written yet', async () => {
  const user = renderWithDay(<AppJournal />);
  await pickDay(user, 'Sat');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByText(/Come back on Saturday/)).toBeInTheDocument();
});

test('shows how each habit went that day, only for habits that existed then', async () => {
  seed({
    habits: [
      { id: 1, kind: 'daily', name: 'Pray', target: 5, createdOn: '2026-09-01', log: { '2026-10-02': 5, '2026-09-29': 3 } },
      { id: 2, kind: 'routine', name: 'No smoking', createdOn: '2026-09-01', log: { '2026-10-02': { plus: 2, minus: 1 } } },
      { id: 3, kind: 'daily', name: 'Water', target: 8, createdOn: '2026-10-01', log: {} },
    ],
  });
  const user = renderWithDay(<AppJournal />);

  const today = within(screen.getByRole('list', { name: 'Habits that day' }));
  expect(today.getByText('Pray').parentElement).toHaveTextContent('Pray 5/5');
  expect(today.getByText('No smoking').parentElement).toHaveTextContent('No smoking +2 −1');
  expect(today.getByText('Water').parentElement).toHaveTextContent('Water 0/8');

  await pickDay(user, 'Tue');
  const tuesday = within(screen.getByRole('list', { name: 'Habits that day' }));
  expect(tuesday.getByText('Pray').parentElement).toHaveTextContent('Pray 3/5');
  expect(tuesday.getByText('No smoking').parentElement).toHaveTextContent('No smoking no taps');
  expect(tuesday.queryByText('Water')).not.toBeInTheDocument();
});

test('past entries lists other dates newest first, with older ones on demand', async () => {
  const journal = { '2026-10-02': 'today', '2026-09-30': 'wednesday', '2026-09-01': 'september' };
  for (let d = 1; d <= 25; d++) journal[`2026-08-${String(d).padStart(2, '0')}`] = `august ${d}`;
  seed({ journal });
  const user = renderWithDay(<AppJournal />);

  await user.click(pastButton());
  const dialog = await screen.findByRole('dialog', { name: 'Past entries' });
  const texts = () => within(dialog).getAllByRole('listitem').map((li) => li.querySelector('.ant-typography:last-child').textContent);

  expect(within(dialog).queryByText('today')).not.toBeInTheDocument();
  expect(texts().slice(0, 3)).toEqual(['wednesday', 'september', 'august 25']);
  expect(texts()).toHaveLength(20);

  await user.click(within(dialog).getByRole('button', { name: 'Show older entries' }));
  expect(texts()).toHaveLength(27);
  expect(within(dialog).queryByRole('button', { name: 'Show older entries' })).not.toBeInTheDocument();
});

test('past entries is disabled until there is another entry', () => {
  renderWithDay(<AppJournal />);
  expect(pastButton()).toBeDisabled();
});
