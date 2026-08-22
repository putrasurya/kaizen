import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppEmbed from './AppEmbed';
import { StoreProvider } from '../redux/store';

function renderEmbed() {
  return render(
    <StoreProvider>
      <AppEmbed />
    </StoreProvider>
  );
}

test('adding an embed renders an iframe pointed at the video id', async () => {
  renderEmbed();

  userEvent.click(screen.getByRole('button', { name: /plus/i }));
  userEvent.type(screen.getByPlaceholderText(/cr67ukCRPlw/i), 'abc123XYZ');
  userEvent.click(screen.getByRole('button', { name: 'OK' }));

  const iframe = await screen.findByTitle(/\d+/);
  expect(iframe).toHaveAttribute('src', 'https://youtube.com/embed/abc123XYZ');
});

test('deleting an embed removes its iframe', async () => {
  renderEmbed();

  userEvent.click(screen.getByRole('button', { name: /plus/i }));
  userEvent.type(screen.getByPlaceholderText(/cr67ukCRPlw/i), 'abc123XYZ');
  userEvent.click(screen.getByRole('button', { name: 'OK' }));
  await screen.findByTitle(/\d+/);

  userEvent.click(screen.getByRole('button', { name: /delete/i }));

  expect(screen.queryByTitle(/\d+/)).not.toBeInTheDocument();
});
