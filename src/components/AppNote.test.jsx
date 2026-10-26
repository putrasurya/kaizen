import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppNote from './AppNote';
import { StoreProvider } from '../redux/store';
import { mockViewportWidth } from '../test-utils/mockViewport';
import { renderWithDay, pickDay } from '../test-utils/renderWithDay';

// Modal.confirm renders outside the tree, and a closing one from an earlier
// test can linger under jsdom, so take the newest matching dialog.
async function findConfirmDialog(regex) {
  let title;
  await vi.waitFor(() => {
    const found = Array.from(document.querySelectorAll('.ant-modal-confirm-title')).filter((el) => regex.test(el.textContent));
    if (!found.length) throw new Error(`No confirm dialog matching ${regex} yet`);
    title = found[found.length - 1];
  });
  return title.closest('[role="dialog"]');
}

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

  await user.click(screen.getByRole('button', { name: 'Add reminder' }));
  await user.type(screen.getByPlaceholderText(/do something at 3am/i), 'water the plants');
  await user.click(screen.getByRole('button', { name: 'OK' }));

  // Modal's OK button calls form.submit(), which validates/finishes asynchronously.
  expect(await screen.findByText('water the plants')).toBeInTheDocument();
});

test('deleting a note removes it from the list', async () => {
  const user = renderNote();

  await user.click(screen.getByRole('button', { name: 'Add reminder' }));
  await user.type(screen.getByPlaceholderText(/do something at 3am/i), 'water the plants');
  await user.click(screen.getByRole('button', { name: 'OK' }));
  expect(await screen.findByText('water the plants')).toBeInTheDocument();

  // Scope to the note's own list item — antd 6's Modal also has a close (X)
  // button with the same accessible name, and by this point it may still be
  // present (mid closing animation) alongside the delete button we actually want.
  const noteItem = screen.getByText('water the plants').closest('li');
  await user.click(within(noteItem).getByRole('button', { name: 'Delete reminder' }));

  expect(screen.queryByText('water the plants')).not.toBeInTheDocument();
});

describe('responsive layout', () => {
  let restoreViewport;
  afterEach(() => restoreViewport?.());

  test('uses a large add button and a large (no iOS zoom) input on a phone', async () => {
    restoreViewport = mockViewportWidth(360);
    const user = renderNote();

    const addButton = screen.getByRole('button', { name: 'Add reminder' });
    expect(addButton).toHaveClass('ant-btn-lg');

    await user.click(addButton);
    expect(screen.getByPlaceholderText(/do something at 3am/i)).toHaveClass('ant-input-lg');
  });

  test('keeps the default sizes on desktop', async () => {
    restoreViewport = mockViewportWidth(1280);
    const user = renderNote();

    const addButton = screen.getByRole('button', { name: 'Add reminder' });
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
    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    expect(screen.getByRole('radio', { name: 'Only Wednesday' })).toBeChecked();
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

    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    await user.type(screen.getByPlaceholderText(/do something at 3am/i), '   ');
    await user.click(screen.getByRole('button', { name: 'OK' }));

    await vi.waitFor(() => {
      expect(JSON.parse(window.localStorage.getItem(KEY)).notes).toHaveLength(2);
    });
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
  test('an every-day reminder shows on every day, above that day\'s own', async () => {
    const user = renderWithDay(<AppNote />);

    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    await user.type(screen.getByPlaceholderText(/do something at 3am/i), 'drink water');
    await user.click(screen.getByRole('radio', { name: 'Every day' }).closest('label'));
    await user.click(screen.getByRole('button', { name: 'OK' }));

    expect(await screen.findByText('drink water')).toBeInTheDocument();
    const saved = JSON.parse(window.localStorage.getItem(KEY)).notes;
    expect(saved.find((n) => n.content === 'drink water').day).toBe('every');

    for (const day of [/^Mon$/, /^Wed$/, /^Sun$/]) {
      await pickDay(user, day);
      const items = screen.getAllByRole('listitem');
      expect(items[0]).toHaveTextContent('drink water');
      expect(within(items[0]).getByText('Every day')).toBeInTheDocument();
    }
    await pickDay(user, /^Mon$/);
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['drink waterEvery day', 'monday note']);
  });

  test('the dialog starts on "Only <day>" again after adding an every-day reminder', async () => {
    const user = renderWithDay(<AppNote />);

    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    await user.type(screen.getByPlaceholderText(/do something at 3am/i), 'stretch');
    await user.click(screen.getByRole('radio', { name: 'Every day' }).closest('label'));
    await user.click(screen.getByRole('button', { name: 'OK' }));
    await screen.findByText('stretch');

    await user.click(screen.getByRole('button', { name: 'Add reminder' }));
    expect(screen.getByRole('radio', { name: 'Only Friday' })).toBeChecked();
    expect(screen.getByPlaceholderText(/do something at 3am/i)).toHaveValue('');
  });

  test('deleting an every-day reminder asks first, then removes it from all days', async () => {
    window.localStorage.setItem(KEY, JSON.stringify({
      version: 8,
      notes: [
        { id: 1, day: 'fri', content: 'friday note' },
        { id: 3, day: 'every', content: 'drink water' },
      ],
    }));
    const user = renderWithDay(<AppNote />);

    const item = screen.getByText('drink water').closest('li');
    await user.click(within(item).getByRole('button', { name: 'Delete reminder' }));
    const dialog = await findConfirmDialog(/Delete from every day\?/);
    expect(screen.getByText('drink water')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await vi.waitFor(() => expect(screen.queryByText('drink water')).not.toBeInTheDocument());
    expect(JSON.parse(window.localStorage.getItem(KEY)).notes.map((n) => n.content)).toEqual(['friday note']);
  });

  test('deleting a one-day reminder is still immediate', async () => {
    const user = renderWithDay(<AppNote />);
    const item = screen.getByText('friday note').closest('li');
    await user.click(within(item).getByRole('button', { name: 'Delete reminder' }));
    // Gone straight away, with no dialog in between.
    expect(screen.queryByText('friday note')).not.toBeInTheDocument();
  });
});
