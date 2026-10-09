import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Milestones from './Milestones';
import { StoreProvider, loadState, STATE_VERSION } from '../redux/store';

const KEY = import.meta.env.VITE_STORAGEKEY;

// Saturday 2026-10-10.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 10, 9, 0));
});
afterEach(() => vi.useRealTimers());

function seed(milestones) {
  window.localStorage.setItem(KEY, JSON.stringify({
    version: STATE_VERSION, timers: [], notes: [], todos: [], habits: [], journal: {}, embeds: [], milestones,
  }));
}
const saved = () => JSON.parse(window.localStorage.getItem(KEY)).milestones;

function renderMilestones() {
  const user = userEvent.setup();
  render(<StoreProvider><Milestones open onClose={() => {}} /></StoreProvider>);
  return user;
}

// Matched by title text: a closed modal can linger under jsdom (no
// transitionend), so there may be more than one dialog in the DOM.
const dialogWith = (title) =>
  waitFor(() => {
    const found = screen.getAllByRole('dialog').filter((d) => within(d).queryByText(title)).pop();
    expect(found).toBeDefined();
    return found;
  });
const count = () => screen.getByTestId('milestone-count').textContent;
const achievedList = () => screen.queryByRole('list', { name: /^Achieved in/ });
const achievedTitles = () => within(achievedList()).getAllByRole('listitem').map((li) => li.querySelector('strong').textContent);

test('starts empty, and a goal can be added for this year', async () => {
  const user = renderMilestones();
  expect(screen.getByRole('heading', { name: '2026' })).toBeInTheDocument();
  expect(count()).toBe('Nothing here yet');

  await user.type(screen.getByRole('textbox', { name: 'New goal' }), 'Pass the CKA exam{Enter}');
  expect(within(screen.getByRole('list', { name: 'Goals for 2026' })).getByText('Pass the CKA exam')).toBeInTheDocument();
  expect(count()).toBe('0 of 1 reached');
  expect(saved()).toMatchObject([{ title: 'Pass the CKA exam', achievedOn: null, year: 2026 }]);
});

test('marking a goal achieved asks for the date (today by default) and moves it into the timeline', async () => {
  seed([{ id: 1, title: 'Pass the CKA exam', note: '', achievedOn: null, year: 2026 }]);
  const user = renderMilestones();

  await user.click(screen.getByRole('button', { name: 'Mark "Pass the CKA exam" achieved' }));
  const form = await dialogWith('Mark achieved');
  expect(within(form).getByLabelText('Date')).toHaveValue('2026-10-10');
  await user.type(within(form).getByLabelText('Note (optional)'), 'Score 87%');
  await user.click(within(form).getByRole('button', { name: 'Mark achieved' }));

  expect(achievedTitles()).toEqual(['Pass the CKA exam']);
  expect(within(achievedList()).getByText('Oct 10')).toBeInTheDocument();
  expect(within(achievedList()).getByText('Score 87%')).toBeInTheDocument();
  expect(screen.queryByRole('list', { name: 'Goals for 2026' })).not.toBeInTheDocument();
  expect(count()).toBe('1 of 1 reached');
  expect(saved()[0]).toMatchObject({ achievedOn: '2026-10-10', note: 'Score 87%' });
});

test('a milestone that was never a goal can be added with its date; newest shows first', async () => {
  seed([{ id: 1, title: 'Quit smoking', note: '', achievedOn: '2026-03-12', year: 2026 }]);
  const user = renderMilestones();

  await user.click(screen.getByRole('button', { name: /Add milestone/ }));
  const form = await dialogWith('Add a milestone');
  await user.type(within(form).getByLabelText('Milestone'), 'Got the AWS certification');
  fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2026-10-08' } });
  await user.click(within(form).getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(achievedTitles()).toEqual(['Got the AWS certification', 'Quit smoking']));
  expect(count()).toBe('2 of 2 reached');
});

test('a date in the future is refused', async () => {
  const user = renderMilestones();
  await user.click(screen.getByRole('button', { name: /Add milestone/ }));
  const form = await dialogWith('Add a milestone');
  await user.type(within(form).getByLabelText('Milestone'), 'Too early');
  fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2026-12-01' } });
  await user.click(within(form).getByRole('button', { name: 'Add' }));
  expect(await within(form).findByText("That date hasn't come yet")).toBeInTheDocument();
  expect(window.localStorage.getItem(KEY)).toBeNull();
});

test('editing a milestone changes it; moving its date to another year moves it there; delete asks first', async () => {
  seed([{ id: 1, title: 'First 10K run', note: '', achievedOn: '2026-08-20', year: 2026 }]);
  const user = renderMilestones();

  await user.click(within(achievedList()).getByRole('button', { name: /First 10K run/ }));
  let form = await dialogWith('Edit milestone');
  const title = within(form).getByLabelText('Milestone');
  await user.clear(title);
  await user.type(title, 'First half marathon');
  fireEvent.change(within(form).getByLabelText('Date'), { target: { value: '2025-11-02' } });
  await user.click(within(form).getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(count()).toBe('Nothing here yet'));
  await user.click(screen.getByRole('button', { name: 'Previous year' }));
  expect(achievedTitles()).toEqual(['First half marathon']);

  await user.click(within(achievedList()).getByRole('button', { name: /First half marathon/ }));
  form = await dialogWith('Edit milestone');
  await user.click(within(form).getByRole('button', { name: 'Delete' }));
  // The confirmation's own "Delete" button is the last one in the document.
  await waitFor(() => expect(screen.getAllByRole('button', { name: 'Delete' }).length).toBeGreaterThan(1));
  await user.click(screen.getAllByRole('button', { name: 'Delete' }).pop());
  await waitFor(() => expect(saved()).toEqual([]));
});

test('earlier years show what was not reached; next year can be planned but has no "add milestone"', async () => {
  seed([
    { id: 1, title: 'Run a marathon', note: '', achievedOn: null, year: 2025, kept: true },
    { id: 2, title: 'Learned to swim', note: '', achievedOn: '2025-06-01', year: 2025 },
  ]);
  const user = renderMilestones();

  await user.click(screen.getByRole('button', { name: 'Previous year' }));
  expect(screen.getByRole('heading', { name: '2025' })).toBeInTheDocument();
  expect(count()).toBe('1 of 2 reached');
  expect(within(screen.getByRole('list', { name: 'Not reached in 2025' })).getByText('Run a marathon')).toBeInTheDocument();
  expect(screen.queryByRole('textbox', { name: 'New goal' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Previous year' })).toBeDisabled();

  await user.click(screen.getByRole('button', { name: 'Next year' }));
  await user.click(screen.getByRole('button', { name: 'Next year' }));
  expect(screen.getByRole('heading', { name: '2027' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Next year' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Add milestone/ })).not.toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: 'New goal' }), 'Visit Japan{Enter}');
  expect(saved().find((m) => m.title === 'Visit Japan')).toMatchObject({ year: 2027 });
});

describe('goals left over from earlier years', () => {
  const leftover = [
    { id: 1, title: 'Read 12 books', note: '', achievedOn: null, year: 2025 },
    { id: 2, title: 'Save emergency fund', note: '', achievedOn: null, year: 2024 },
  ];

  test('can be brought into this year', async () => {
    seed(leftover);
    const user = renderMilestones();
    expect(screen.getByText("2 goals from earlier years weren't reached.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bring into 2026' }));
    expect(within(screen.getByRole('list', { name: 'Goals for 2026' })).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByText(/weren't reached/)).not.toBeInTheDocument();
  });

  test('or left where they were, as not reached', async () => {
    seed(leftover);
    const user = renderMilestones();
    await user.click(screen.getByRole('button', { name: 'Leave them there' }));
    expect(screen.queryByText(/weren't reached/)).not.toBeInTheDocument();
    expect(saved().every((m) => m.kept)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Previous year' }));
    expect(within(screen.getByRole('list', { name: 'Not reached in 2025' })).getByText('Read 12 books')).toBeInTheDocument();
  });
});

test('saved milestones are repaired or dropped; older data gets an empty list', () => {
  window.localStorage.setItem(KEY, JSON.stringify({ version: 6, timers: [], notes: [], todos: [], habits: [], journal: {}, embeds: [] }));
  expect(loadState(KEY, 'sat').milestones).toEqual([]);

  seed([
    null,
    { id: 1, title: '   ' },
    { id: 1, title: 'Dated', achievedOn: '2025-02-03', year: 2030, kept: true },
    { id: 1, title: 'Goal', achievedOn: 'soon', year: 3000, note: 7 },
  ]);
  const [dated, goal] = loadState(KEY, 'sat').milestones;
  expect(dated).toEqual({ id: 1, title: 'Dated', note: '', achievedOn: '2025-02-03', year: 2025, kept: false });
  expect(goal).toMatchObject({ title: 'Goal', note: '', achievedOn: null, year: 2026, kept: false });
  expect(goal.id).not.toBe(1);
});
