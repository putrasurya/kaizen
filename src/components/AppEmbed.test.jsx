import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppEmbed from './AppEmbed';
import { StoreProvider } from '../redux/store';

function renderEmbed() {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <AppEmbed />
    </StoreProvider>
  );
  return user;
}

test('adding an embed renders an iframe pointed at the video id', async () => {
  const user = renderEmbed();

  await user.click(screen.getByRole('button', { name: /plus/i }));
  await user.type(screen.getByPlaceholderText(/cr67ukCRPlw/i), 'abc123XYZ');
  await user.click(screen.getByRole('button', { name: 'OK' }));

  const iframe = await screen.findByTitle(/\d+/);
  expect(iframe).toHaveAttribute('src', 'https://youtube.com/embed/abc123XYZ');
});

test('deleting an embed removes its iframe', async () => {
  const user = renderEmbed();

  await user.click(screen.getByRole('button', { name: /plus/i }));
  await user.type(screen.getByPlaceholderText(/cr67ukCRPlw/i), 'abc123XYZ');
  await user.click(screen.getByRole('button', { name: 'OK' }));
  await screen.findByTitle(/\d+/);

  await user.click(screen.getByRole('button', { name: /delete/i }));

  expect(screen.queryByTitle(/\d+/)).not.toBeInTheDocument();
});
