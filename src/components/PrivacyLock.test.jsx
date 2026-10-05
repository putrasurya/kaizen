import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { StoreProvider } from '../redux/store';
import { createLock, lockKey } from '../utilities/privacy-lock';

const KEY = import.meta.env.VITE_STORAGEKEY;

function renderApp() {
  const user = userEvent.setup();
  render(<StoreProvider><App /></StoreProvider>);
  return user;
}

async function seedLock(overrides = {}) {
  window.localStorage.setItem(lockKey(), JSON.stringify({ ...(await createLock('1234')), ...overrides }));
}

const savedLock = () => JSON.parse(window.localStorage.getItem(lockKey()));
const lockScreen = () => screen.queryByRole('dialog', { name: 'Kaizen is locked' });

async function typePin(user, pin, container = document.body) {
  for (const digit of pin) await user.click(within(container).getByRole('button', { name: digit }));
}

let visibility = 'visible';
beforeAll(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => visibility });
});
afterEach(() => {
  visibility = 'visible';
});
function setVisible(visible) {
  visibility = visible ? 'visible' : 'hidden';
  act(() => document.dispatchEvent(new Event('visibilitychange')));
}

async function openSettings(user) {
  await user.click(screen.getByRole('button', { name: 'Privacy lock' }));
  return screen.findByRole('dialog', { name: 'Privacy lock' });
}

describe('setting up', () => {
  test('off by default: the app opens straight away', () => {
    renderApp();
    expect(lockScreen()).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Timers' })).toBeInTheDocument();
  });

  test('choose a PIN, repeat it, and agree to the warning before it turns on', async () => {
    const user = renderApp();
    const dialog = await openSettings(user);
    expect(within(dialog).getByText(/isn't encrypted/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Set up a PIN' }));
    expect(within(dialog).getByText('Choose a 4-digit PIN')).toBeInTheDocument();
    await typePin(user, '2580', dialog);
    expect(await within(dialog).findByText('Enter it again')).toBeInTheDocument();
    await typePin(user, '2580', dialog);

    expect(await within(dialog).findByText("A forgotten PIN can't be recovered")).toBeInTheDocument();
    const turnOn = within(dialog).getByRole('button', { name: 'Turn on privacy lock' });
    expect(turnOn).toBeDisabled();
    await user.click(within(dialog).getByRole('checkbox', { name: /forgetting my PIN means losing my data/ }));
    await user.click(turnOn);

    expect(await within(dialog).findByText('Privacy lock is on.')).toBeInTheDocument();
    expect(savedLock()).toMatchObject({ relockAfter: 0, failures: 0 });
    expect(window.localStorage.getItem(lockKey())).not.toContain('2580');
  });

  test('a repeated PIN that doesn\'t match starts over', async () => {
    const user = renderApp();
    const dialog = await openSettings(user);
    await user.click(within(dialog).getByRole('button', { name: 'Set up a PIN' }));
    await typePin(user, '1111', dialog);
    await within(dialog).findByText('Enter it again');
    await typePin(user, '2222', dialog);

    expect(await within(dialog).findByText("Those didn't match. Choose a PIN again.")).toBeInTheDocument();
    expect(within(dialog).getByText('Choose a 4-digit PIN')).toBeInTheDocument();
    expect(window.localStorage.getItem(lockKey())).toBeNull();
  });
});

describe('when locked', () => {
  test('opens locked, with the app hidden but still running underneath', async () => {
    await seedLock();
    renderApp();
    expect(lockScreen()).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Timers' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Timers', hidden: true })).toBeInTheDocument();
  });

  test('the right PIN unlocks; a wrong one says how many tries are left', async () => {
    await seedLock();
    const user = renderApp();

    await typePin(user, '0000', lockScreen());
    expect(await screen.findByText('Wrong PIN. 4 tries left before a wait.')).toBeInTheDocument();
    expect(lockScreen()).toBeInTheDocument();

    await typePin(user, '1234', lockScreen());
    await waitFor(() => expect(lockScreen()).not.toBeInTheDocument());
    expect(screen.getByRole('region', { name: 'Timers' })).toBeInTheDocument();
    expect(savedLock().failures).toBe(0);
  });

  test('a keyboard works too', async () => {
    await seedLock();
    const user = renderApp();
    await user.keyboard('129{Backspace}34');
    await waitFor(() => expect(lockScreen()).not.toBeInTheDocument());
  });

  test('too many wrong tries means a wait, which survives a reload', async () => {
    await seedLock({ failures: 4 });
    const user = renderApp();

    await typePin(user, '9999', lockScreen());
    expect(await screen.findByText(/Too many tries. Try again in 0:(29|30)\./)).toBeInTheDocument();
    expect(within(lockScreen()).getByRole('button', { name: '1' })).toBeDisabled();
    expect(savedLock().failures).toBe(5);
    expect(savedLock().waitUntil).toBeGreaterThan(Date.now());
  });

  test('forgot PIN erases everything, only after typing ERASE', async () => {
    await seedLock();
    window.localStorage.setItem(KEY, JSON.stringify({ version: 6, timers: [], notes: [], todos: [], habits: [], journal: { '2026-10-06': 'secret' }, embeds: [] }));
    const user = renderApp();

    await user.click(screen.getByRole('button', { name: 'Forgot PIN?' }));
    const erase = screen.getByRole('button', { name: 'Erase everything' });
    expect(erase).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: 'Type ERASE to confirm' }), 'ERASE');
    await user.click(erase);

    expect(window.localStorage.getItem(KEY)).toBeNull();
    expect(window.localStorage.getItem(lockKey())).toBeNull();
  });

  test('cancelling "forgot PIN" goes back to the PIN pad', async () => {
    await seedLock();
    const user = renderApp();
    await user.click(screen.getByRole('button', { name: 'Forgot PIN?' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Enter your PIN')).toBeInTheDocument();
  });
});

describe('leaving the app', () => {
  async function unlockedApp(relockAfter) {
    await seedLock({ relockAfter });
    const user = renderApp();
    await typePin(user, '1234', lockScreen());
    await waitFor(() => expect(lockScreen()).not.toBeInTheDocument());
    return user;
  }

  test('covers the app as soon as it goes to the background', async () => {
    await unlockedApp(60000);
    setVisible(false);
    expect(screen.queryByRole('region', { name: 'Timers' })).not.toBeInTheDocument();
  });

  test('"Immediately" asks for the PIN on every return', async () => {
    await unlockedApp(0);
    setVisible(false);
    setVisible(true);
    expect(lockScreen()).toBeInTheDocument();
  });

  test('"After 1 minute" lets a quick return through, but not a long one', async () => {
    await unlockedApp(60000);
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      setVisible(false);
      vi.setSystemTime(Date.now() + 20 * 1000);
      setVisible(true);
      expect(lockScreen()).not.toBeInTheDocument();
      expect(screen.getByRole('region', { name: 'Timers' })).toBeInTheDocument();

      setVisible(false);
      vi.setSystemTime(Date.now() + 2 * 60 * 1000);
      setVisible(true);
      expect(lockScreen()).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('settings when on', () => {
  async function unlocked() {
    await seedLock();
    const user = renderApp();
    await typePin(user, '1234', lockScreen());
    await waitFor(() => expect(lockScreen()).not.toBeInTheDocument());
    return user;
  }

  test('turning off needs the PIN', async () => {
    const user = await unlocked();
    const dialog = await openSettings(user);
    await user.click(within(dialog).getByRole('button', { name: 'Turn off privacy lock' }));
    await typePin(user, '1111', dialog);
    expect(await within(dialog).findByText('Wrong PIN. 4 tries left before a wait.')).toBeInTheDocument();
    await typePin(user, '1234', dialog);
    expect(await within(dialog).findByText('Privacy lock is off.')).toBeInTheDocument();
    expect(window.localStorage.getItem(lockKey())).toBeNull();
  });

  test('changing the PIN needs the old one, then the new one twice', async () => {
    const user = await unlocked();
    const dialog = await openSettings(user);
    await user.click(within(dialog).getByRole('button', { name: 'Change PIN' }));
    await typePin(user, '1234', dialog);
    await within(dialog).findByText('Choose a new PIN');
    await typePin(user, '5678', dialog);
    await within(dialog).findByText('Enter the new PIN again');
    await typePin(user, '5678', dialog);
    expect(await within(dialog).findByText('PIN changed.')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Lock now' }));
    expect(lockScreen()).toBeInTheDocument();
    await typePin(user, '1234', lockScreen());
    expect(await screen.findByText(/Wrong PIN/)).toBeInTheDocument();
    await typePin(user, '5678', lockScreen());
    await waitFor(() => expect(lockScreen()).not.toBeInTheDocument());
  });

  test('re-lock timing is saved straight away', async () => {
    const user = await unlocked();
    const dialog = await openSettings(user);
    await user.click(within(dialog).getByRole('combobox'));
    await user.click(await screen.findByTitle('After 5 minutes'));
    expect(savedLock().relockAfter).toBe(5 * 60 * 1000);
  });
});
