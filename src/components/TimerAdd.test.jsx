import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppTimer from './AppTimer';
import { StoreProvider } from '../redux/store';

// AppTimer renders TimerAdd itself, so tests exercise TimerAdd through AppTimer
// rather than mounting it standalone (avoids duplicate "Add Timer" buttons and lets
// the "submit adds a timer" test assert against the resulting TimerItem).
function renderAppTimer() {
  return render(
    <StoreProvider>
      <AppTimer />
    </StoreProvider>
  );
}

test('the default preview shows 1 hour 0 minutes before any changes', () => {
  renderAppTimer();

  userEvent.click(screen.getByRole('button', { name: /add timer/i }));

  // RTL's getByText matches an element's own direct text nodes, so the number and
  // its "hours"/"minutes" <small> label are separate elements here.
  expect(screen.getByText('1')).toBeInTheDocument();
  expect(screen.getByText('hours')).toBeInTheDocument();
});

test('changing the minute radio updates the live preview', () => {
  renderAppTimer();

  userEvent.click(screen.getByRole('button', { name: /add timer/i }));
  userEvent.click(screen.getByRole('radio', { name: '20m' }));

  expect(screen.getByText('20')).toBeInTheDocument();
  expect(screen.getByText('minutes')).toBeInTheDocument();
});

test('submitting adds a timer with the summed seconds from selected radios', async () => {
  renderAppTimer();

  userEvent.click(screen.getByRole('button', { name: /add timer/i }));
  userEvent.type(screen.getByPlaceholderText(/Focus on Works/i), 'Deep Work');
  // Leave hours1 (1H) / hours2 (0H) at their defaults; only change minutes1 to 20m.
  userEvent.click(screen.getByRole('radio', { name: '20m' }));
  userEvent.click(screen.getByRole('button', { name: 'OK' }));

  expect(await screen.findByText('Deep Work')).toBeInTheDocument();
  // 1H (hours1 default) + 0H (hours2 default) + 20m (minutes1) + 0m (minutes2
  // default) = 1h20m, shown both by AppTimer's "Times left" header and by the new
  // TimerItem's TimerCountdown, both formatted as "1.20".
  expect(screen.getAllByText(/1\.20/).length).toBeGreaterThan(0);
});
