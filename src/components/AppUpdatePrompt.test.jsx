import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AppUpdatePrompt from './AppUpdatePrompt';

const setNeedRefresh = vi.fn();
const updateServiceWorker = vi.fn();
let needRefresh = false;

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker,
  }),
}));

beforeEach(() => {
  needRefresh = false;
  setNeedRefresh.mockClear();
  updateServiceWorker.mockClear();
});

test('renders nothing while the app is up to date', () => {
  render(<AppUpdatePrompt />);
  expect(screen.queryByText(/new version/i)).not.toBeInTheDocument();
});

test('asks before reloading when a new version is waiting', async () => {
  needRefresh = true;
  const user = userEvent.setup();
  render(<AppUpdatePrompt />);

  expect(await screen.findByText(/new version of Kaizen is available/i)).toBeInTheDocument();
  expect(updateServiceWorker).not.toHaveBeenCalled();

  await user.click(screen.getByRole('button', { name: 'Reload' }));
  expect(updateServiceWorker).toHaveBeenCalledWith(true);
});
