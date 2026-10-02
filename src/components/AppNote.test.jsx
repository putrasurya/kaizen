import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppNote from './AppNote';
import { StoreProvider } from '../redux/store';
import { mockViewportWidth } from '../test-utils/mockViewport';
import { renderWithDay, pickDay } from '../test-utils/renderWithDay';

function renderNote() {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <AppNote />
    </StoreProvider>
  );
  return user;
}

test('adding a note shows it in the list', async () => {
  const user = renderNote();

  await user.click(screen.getByRole('button', { name: /plus/i }));
  await user.type(screen.getByPlaceholderText(/do something at 3am/i), 'water the plants');
  await user.click(screen.getByRole('button', { name: 'OK' }));

  // Modal's OK button calls form.submit(), which validates/finishes asynchronously.
  expect(await screen.findByText('water the plants')).toBeInTheDocument();
});

test('deleting a note removes it from the list', async () => {
  const user = renderNote();

  await user.click(screen.getByRole('button', { name: /plus/i }));
  await user.type(screen.getByPlaceholderText(/do something at 3am/i), 'water the plants');
  await user.click(screen.getByRole('button', { name: 'OK' }));
  expect(await screen.findByText('water the plants')).toBeInTheDocument();

  // Scope to the note's own list item — antd 6's Modal also has a close (X)
  // button with the same accessible name, and by this point it may still be
  // present (mid closing animation) alongside the delete button we actually want.
  const noteItem = screen.getByText('water the plants').closest('li');
  await user.click(within(noteItem).getByRole('button', { name: /close/i }));

  expect(screen.queryByText('water the plants')).not.toBeInTheDocument();
});

describe('responsive layout', () => {
  let restoreViewport;
  afterEach(() => restoreViewport?.());

  test('uses a large add button and a large (no iOS zoom) input on a phone', async () => {
    restoreViewport = mockViewportWidth(360);
    const user = renderNote();

    const addButton = screen.getByRole('button', { name: /plus/i });
    expect(addButton).toHaveClass('ant-btn-lg');

    await user.click(addButton);
    expect(screen.getByPlaceholderText(/do something at 3am/i)).toHaveClass('ant-input-lg');
  });

  test('keeps the default sizes on desktop', async () => {
    restoreViewport = mockViewportWidth(1280);
    const user = renderNote();

    const addButton = screen.getByRole('button', { name: /plus/i });
    expect(addButton).not.toHaveClass('ant-btn-lg');

    await user.click(addButton);
    expect(screen.getByPlaceholderText(/do something at 3am/i)).not.toHaveClass('ant-input-lg');
  });
});

describe('notes by day', () => {
  const KEY = import.meta.env.VITE_STORAGEKEY;

  // Only Date is faked; userEvent and antd need real timers. 2026-10-02 is a Friday.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 2, 10, 0, 0));
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 3,
      timers: [],
      todos: [],
      embeds: [],
      notes: [
        { id: 1, day: 'fri', content: 'friday note' },
        { id: 2, day: 'mon', content: 'monday note' },
      ],
    }));
  });
  afterEach(() => vi.useRealTimers());

  test('shows only the notes of the selected day', async () => {
    const user = renderWithDay(<AppNote />);

    expect(screen.getByText('friday note')).toBeInTheDocument();
    expect(screen.queryByText('monday note')).not.toBeInTheDocument();

    await pickDay(user, /^Mon$/);
    expect(screen.getByText('monday note')).toBeInTheDocument();
    expect(screen.queryByText('friday note')).not.toBeInTheDocument();
  });

  test('a note added while viewing a day belongs to that day', async () => {
    const user = renderWithDay(<AppNote />);

    await pickDay(user, /^Wed$/);
    await user.click(screen.getByRole('button', { name: /plus/i }));
    expect(screen.getByText('What to remind on Wednesday?')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/do something at 3am/i), 'midweek check');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('midweek check')).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem(KEY)).notes;
    expect(saved.find((n) => n.content === 'midweek check').day).toBe('wed');

    await pickDay(user, /^Fri/);
    expect(screen.queryByText('midweek check')).not.toBeInTheDocument();
  });

  test('a blank note is not added', async () => {
    const user = renderWithDay(<AppNote />);

    await user.click(screen.getByRole('button', { name: /plus/i }));
    await user.type(screen.getByPlaceholderText(/do something at 3am/i), '   ');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    await vi.waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(KEY)).notes).toHaveLength(2);
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});
