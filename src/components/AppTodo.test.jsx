import { act, cleanup, screen, within } from '@testing-library/react';
import AppTodo from './AppTodo';
import { renderWithDay, dayRadio, pickDay } from '../test-utils/renderWithDay';
import { mockViewportWidth } from '../test-utils/mockViewport';

const KEY = import.meta.env.VITE_STORAGEKEY;

// Only Date is faked; userEvent and antd need real timers. 2026-10-02 is a
// Friday, in the Monday-first week 2026-09-28 .. 2026-10-04.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
});
afterEach(() => vi.useRealTimers());

function seed(todos) {
  window.localStorage.setItem(KEY, JSON.stringify({ version: 3, timers: [], notes: [], embeds: [], todos }));
}

const savedTodos = () => JSON.parse(window.localStorage.getItem(KEY)).todos;
const count = () => screen.getByTestId('todo-count').textContent;
const input = () => screen.getByRole('textbox', { name: 'New todo' });
const checkbox = (name) => screen.getByRole('checkbox', { name });
const row = (text) => screen.getByText(text).closest('li');

async function add(user, text) {
  await user.type(input(), `${text}{Enter}`);
}

test('adds todos with Enter or the button, to the end of the list, and counts them', async () => {
  const user = renderWithDay(<AppTodo />);
  expect(count()).toBe('0/0 done');

  await add(user, 'stretch');
  await user.type(input(), 'read');
  await user.click(screen.getByRole('button', { name: 'Add todo' }));

  expect(input()).toHaveValue('');
  const items = screen.getAllByRole('listitem').map((li) => li.textContent);
  expect(items).toEqual(['stretch', 'read']);
  expect(count()).toBe('0/2 done');
  expect(savedTodos()).toMatchObject([
    { day: 'fri', text: 'stretch', doneOn: null },
    { day: 'fri', text: 'read', doneOn: null },
  ]);
});

test('empty or whitespace-only input is ignored', async () => {
  const user = renderWithDay(<AppTodo />);

  await user.type(input(), '{Enter}');
  await user.type(input(), '    {Enter}');
  expect(screen.getByRole('button', { name: 'Add todo' })).toBeDisabled();

  expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  expect(count()).toBe('0/0 done');
  expect(window.localStorage.getItem(KEY)).toBeNull();
});

test('toggling marks a todo done (dimmed, struck through, moved after open ones) and back', async () => {
  seed([
    { id: 1, day: 'fri', text: 'one', doneOn: null },
    { id: 2, day: 'fri', text: 'two', doneOn: null },
  ]);
  const user = renderWithDay(<AppTodo />);

  await user.click(checkbox('one'));

  expect(checkbox('one')).toBeChecked();
  expect(screen.getByText('one')).toHaveClass(/done/);
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['two', 'one']);
  expect(count()).toBe('1/2 done');
  expect(savedTodos()[0].doneOn).toBe('2026-10-02');

  await user.click(checkbox('one'));
  expect(checkbox('one')).not.toBeChecked();
  expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two']);
  expect(count()).toBe('0/2 done');
});

test('deletes a todo', async () => {
  seed([{ id: 1, day: 'fri', text: 'one', doneOn: null }, { id: 2, day: 'fri', text: 'two', doneOn: null }]);
  const user = renderWithDay(<AppTodo />);

  await user.click(within(row('one')).getByRole('button', { name: 'Delete' }));

  expect(screen.queryByText('one')).not.toBeInTheDocument();
  expect(savedTodos().map((t) => t.text)).toEqual(['two']);
  expect(count()).toBe('0/1 done');
});

test('edits the text inline; Enter saves, Escape and blank text keep the old text', async () => {
  seed([{ id: 1, day: 'fri', text: 'old', doneOn: null }]);
  const user = renderWithDay(<AppTodo />);

  await user.click(within(row('old')).getByRole('button', { name: 'Edit' }));
  const editor = screen.getByRole('textbox', { name: 'Edit todo' });
  await user.clear(editor);
  await user.type(editor, 'new{Enter}');
  expect(screen.getByText('new')).toBeInTheDocument();
  expect(savedTodos()[0].text).toBe('new');

  await user.click(within(row('new')).getByRole('button', { name: 'Edit' }));
  await user.type(screen.getByRole('textbox', { name: 'Edit todo' }), ' changed{Escape}');
  expect(screen.getByText('new')).toBeInTheDocument();

  await user.click(within(row('new')).getByRole('button', { name: 'Edit' }));
  await user.clear(screen.getByRole('textbox', { name: 'Edit todo' }));
  await user.keyboard('{Enter}');
  expect(screen.getByText('new')).toBeInTheDocument();
  expect(savedTodos()[0].text).toBe('new');
});

test('only shows the selected day\'s todos, and adds to that day', async () => {
  seed([{ id: 1, day: 'fri', text: 'friday', doneOn: null }, { id: 2, day: 'mon', text: 'monday', doneOn: null }]);
  const user = renderWithDay(<AppTodo />);
  expect(screen.queryByText('monday')).not.toBeInTheDocument();

  await pickDay(user, /^Mon$/);
  expect(screen.getByText('monday')).toBeInTheDocument();
  expect(screen.queryByText('friday')).not.toBeInTheDocument();

  await add(user, 'gym');
  expect(savedTodos().find((t) => t.text === 'gym').day).toBe('mon');
});

describe('copy to other days', () => {
  async function copyTo(user, text, dayNames) {
    await user.click(within(row(text)).getByRole('button', { name: 'Copy to other days' }));
    const dialog = (await screen.findByText(`Copy "${text}" to`)).closest('[role="dialog"]');
    for (const name of dayNames) {
      await user.click(within(dialog).getByRole('checkbox', { name }));
    }
    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));
  }

  test('copies start not done, and ticking the original leaves them alone', async () => {
    seed([{ id: 1, day: 'fri', text: 'water plants', doneOn: '2026-10-02' }]);
    const user = renderWithDay(<AppTodo />);

    await copyTo(user, 'water plants', ['Mon', 'Wed']);

    const todos = savedTodos();
    expect(todos).toHaveLength(3);
    expect(new Set(todos.map((t) => t.id)).size).toBe(3);
    expect(todos.find((t) => t.day === 'fri').doneOn).toBe('2026-10-02');
    for (const day of ['mon', 'wed']) {
      expect(todos.find((t) => t.day === day)).toMatchObject({ text: 'water plants', doneOn: null });
    }

    // Un-tick and re-tick today's: Monday's copy is unaffected.
    await user.click(checkbox('water plants'));
    await user.click(checkbox('water plants'));
    await pickDay(user, /^Mon$/);
    expect(checkbox('water plants')).not.toBeChecked();
    expect(count()).toBe('0/1 done');
  });

  test('its own day and days that already have it are disabled', async () => {
    seed([{ id: 1, day: 'fri', text: 'x', doneOn: null }, { id: 2, day: 'tue', text: 'x', doneOn: null }]);
    const user = renderWithDay(<AppTodo />);

    await user.click(within(row('x')).getByRole('button', { name: 'Copy to other days' }));
    const dialog = (await screen.findByText('Copy "x" to')).closest('[role="dialog"]');
    expect(within(dialog).getByRole('checkbox', { name: 'Fri' })).toBeDisabled();
    expect(within(dialog).getByRole('checkbox', { name: 'Tue' })).toBeDisabled();
    expect(within(dialog).getByRole('checkbox', { name: 'Mon' })).toBeEnabled();
  });
});

describe('weekly reset', () => {
  test('a todo ticked today shows not done on the same weekday a week later', async () => {
    seed([{ id: 1, day: 'fri', text: 'review week', doneOn: null }]);
    const user = renderWithDay(<AppTodo />);
    await user.click(checkbox('review week'));
    expect(checkbox('review week')).toBeChecked();
    cleanup();

    vi.setSystemTime(new Date(2026, 9, 9, 9, 0, 0)); // next Friday
    renderWithDay(<AppTodo />);

    expect(checkbox('review week')).not.toBeChecked();
    expect(count()).toBe('0/1 done');
    // Not deleted, and the item itself is unchanged.
    expect(savedTodos()).toMatchObject([{ id: 1, text: 'review week', doneOn: '2026-10-02' }]);
  });

  test('ticking today\'s todo does not tick the same text on another day', async () => {
    seed([{ id: 1, day: 'fri', text: 'walk', doneOn: null }, { id: 2, day: 'sat', text: 'walk', doneOn: null }]);
    const user = renderWithDay(<AppTodo />);

    await user.click(checkbox('walk'));
    await pickDay(user, /^Sat$/);

    expect(checkbox('walk')).not.toBeChecked();
    expect(savedTodos().find((t) => t.day === 'sat').doneOn).toBeNull();
  });

  test('a later day this week can be ticked ahead, and stays done when it arrives', async () => {
    seed([{ id: 1, day: 'sat', text: 'hike', doneOn: null }]);
    const user = renderWithDay(<AppTodo />);
    await pickDay(user, /^Sat$/);

    await user.click(checkbox('hike'));
    expect(savedTodos()[0].doneOn).toBe('2026-10-03');

    vi.setSystemTime(new Date(2026, 9, 3, 8, 0, 0));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(dayRadio(/^Sat\s?\(today\)$/)).toBeChecked();
    expect(checkbox('hike')).toBeChecked();
  });

  test('the open app refreshes on rollover, even a whole week later', async () => {
    seed([{ id: 1, day: 'fri', text: 'review week', doneOn: '2026-10-02' }]);
    const user = renderWithDay(<AppTodo />);
    expect(checkbox('review week')).toBeChecked();
    await pickDay(user, /^Mon$/);

    // Same weekday, one week on: still a new day.
    vi.setSystemTime(new Date(2026, 9, 9, 7, 0, 0));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(dayRadio(/^Fri\s?\(today\)$/)).toBeChecked();
    expect(checkbox('review week')).not.toBeChecked();
    expect(count()).toBe('0/1 done');
  });
});

describe('responsive', () => {
  let restoreViewport;
  afterEach(() => restoreViewport?.());

  test('uses 40px buttons and a large (no iOS zoom) input on a phone', () => {
    restoreViewport = mockViewportWidth(360);
    seed([{ id: 1, day: 'fri', text: 'one', doneOn: null }]);
    renderWithDay(<AppTodo />);

    expect(input()).toHaveClass('ant-input-lg');
    expect(screen.getByRole('button', { name: 'Add todo' })).toHaveClass('ant-btn-lg');
    for (const name of ['Edit', 'Copy to other days', 'Delete']) {
      expect(within(row('one')).getByRole('button', { name })).toHaveClass('ant-btn-lg');
    }
  });

  test('keeps compact sizes on desktop', () => {
    restoreViewport = mockViewportWidth(1280);
    seed([{ id: 1, day: 'fri', text: 'one', doneOn: null }]);
    renderWithDay(<AppTodo />);

    expect(input()).not.toHaveClass('ant-input-lg');
    expect(within(row('one')).getByRole('button', { name: 'Delete' })).toHaveClass('ant-btn-sm');
  });
});
