import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppTimer from './AppTimer';
import { StoreProvider } from '../redux/store';

function renderAppTimer() {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <AppTimer />
    </StoreProvider>
  );
  return user;
}

async function addTimer(user, title) {
  await user.click(screen.getByRole('button', { name: /add timer/i }));
  await user.type(screen.getByPlaceholderText(/Focus on Works/i), title);
  await user.click(screen.getByRole('button', { name: 'OK' }));
}

test('renders the Kaizen title and an Add Timer control with no timers', () => {
  renderAppTimer();

  expect(screen.getByText('Kaizen')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add timer/i })).toBeInTheDocument();
  expect(screen.getByText('0.0 Times left')).toBeInTheDocument();
});

test('renders one TimerItem per added timer and sums totalHour across them', async () => {
  const user = renderAppTimer();

  await addTimer(user, 'Deep Work');
  expect(await screen.findByText('Deep Work')).toBeInTheDocument();
  // Default TimerAdd selection (hours1=1H, hours2=0H, minutes=0) = 1h.
  expect(screen.getByText('1.0 Times left')).toBeInTheDocument();

  await addTimer(user, 'Reading');
  expect(await screen.findByText('Reading')).toBeInTheDocument();
  // Two 1h timers = 2h total.
  expect(screen.getByText('2.0 Times left')).toBeInTheDocument();
});
