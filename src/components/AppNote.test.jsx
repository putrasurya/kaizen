import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppNote from './AppNote';
import { StoreProvider } from '../redux/store';
import { mockViewportWidth } from '../test-utils/mockViewport';

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
