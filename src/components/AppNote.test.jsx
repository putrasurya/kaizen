import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppNote from './AppNote';
import { StoreProvider } from '../redux/store';

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

  await user.click(screen.getByRole('button', { name: /close/i }));

  expect(screen.queryByText('water the plants')).not.toBeInTheDocument();
});
