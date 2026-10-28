import { useContext, useState } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StoreProvider, store, STATE_VERSION } from '../redux/store';
import { SyncProvider } from './SyncProvider';
import SyncSettings, { SyncButton, ago } from '../components/SyncSettings';

// Google is replaced by an in-memory Drive and a sign-in we control.
const auth = vi.hoisted(() => ({ token: null, configured: true }));
const fake = vi.hoisted(() => ({ files: new Map(), nextId: 1, expired: false, slow: null }));

vi.mock('./google-auth', () => ({
  isConfigured: () => auth.configured,
  savedToken: () => auth.token,
  signIn: vi.fn(async () => {
    auth.token = 'token';
    fake.expired = false;
    return 'token';
  }),
  signOut: vi.fn(async () => {
    auth.token = null;
  }),
  forgetToken: () => {
    auth.token = null;
  },
}));

vi.mock('./drive', async () => {
  const { AuthError, DriveError } = await vi.importActual('./drive');
  const check = () => {
    if (fake.expired) throw new AuthError('expired');
  };
  return {
    AuthError,
    DriveError,
    syncFileName: (deviceId) => `kaizen-sync-${deviceId}.json`,
    async findSyncFiles() {
      check();
      return [...fake.files.entries()].map(([id, f]) => ({ id, name: f.name, createdTime: f.created, modifiedTime: new Date().toISOString() }));
    },
    async downloadSyncFile(_t, id) {
      check();
      return JSON.parse(fake.files.get(id).content);
    },
    async createSyncFile(_t, name, content) {
      check();
      const id = `f${fake.nextId++}`;
      fake.files.set(id, { name, content: JSON.stringify(content), created: new Date(Date.UTC(2026, 0, 1) + fake.nextId).toISOString() });
      return { id };
    },
    async updateSyncFile(_t, id, content) {
      check();
      if (fake.slow) await fake.slow();
      fake.files.get(id).content = JSON.stringify(content);
      return { id };
    },
    async deleteSyncFile(_t, id) {
      fake.files.delete(id);
    },
    whoAmI: async () => 'putra@example.com',
  };
});

const KEY = import.meta.env.VITE_STORAGEKEY;
const driveDoc = () => JSON.parse([...fake.files.values()][0].content);
const allText = () => [...fake.files.values()].map((f) => f.content).join('');
const driveHas = (text) => [...fake.files.values()].some((f) => f.content.includes(text));

function seed(parts) {
  window.localStorage.setItem(KEY, JSON.stringify({ version: STATE_VERSION, timers: [], notes: [], todos: [], habits: [], journal: {}, milestones: [], focus: {}, embeds: [], ...parts }));
}

function Harness() {
  const { journal, setJournalEntry, notes, addNote, replaceAll, fullState } = useContext(store);
  const [open, setOpen] = useState(false);
  return (
    <div>
      <SyncButton onClick={() => setOpen(true)} />
      <SyncSettings open={open} onClose={() => setOpen(false)} />
      <button onClick={() => setJournalEntry('2026-10-28', 'Written here')}>write</button>
      <button onClick={() => addNote('Drink water', 'every')}>note</button>
      <button onClick={() => replaceAll({ ...fullState, notes: [], journal: {}, timers: [] })}>wipe</button>
      <pre data-testid="journal">{JSON.stringify(journal)}</pre>
      <pre data-testid="notes">{notes.map((n) => n.content).join(',')}</pre>
    </div>
  );
}

function renderApp() {
  const user = userEvent.setup();
  render(
    <StoreProvider>
      <SyncProvider afterChangeMs={20}>
        <Harness />
      </SyncProvider>
    </StoreProvider>
  );
  return user;
}

async function turnOn(user) {
  await user.click(screen.getByRole('button', { name: 'Sync with Google Drive' }));
  await user.click(await screen.findByRole('button', { name: /Sign in with Google/ }));
  await screen.findByText(/Last synced just now/);
}

beforeEach(() => {
  auth.token = null;
  auth.configured = true;
  fake.files.clear();
  fake.nextId = 1;
  fake.expired = false;
  fake.slow = null;
});

test('without a Google client ID there is no sync button', () => {
  auth.configured = false;
  renderApp();
  expect(screen.queryByRole('button', { name: /sync/i })).not.toBeInTheDocument();
});

test('signing in uploads this device\'s data, and later changes follow by themselves', async () => {
  seed({ journal: { '2026-10-27': 'Before sync' } });
  const user = renderApp();
  await turnOn(user);

  expect(screen.getByText('putra@example.com')).toBeInTheDocument();
  expect(driveHas('Before sync')).toBe(true);
  expect(driveDoc()).toMatchObject({ app: 'kaizen-sync', stateVersion: STATE_VERSION });

  await user.click(screen.getByText('write'));
  await waitFor(() => expect(driveHas('Written here')).toBe(true));
});

test('a second device with its own data is asked, and "Use the data in Google Drive" keeps a copy aside', async () => {
  // Drive already has another device's data.
  seed({ journal: { '2026-10-26': 'From the laptop' } });
  const first = renderApp();
  await turnOn(first);
  document.body.innerHTML = '';
  window.localStorage.clear();

  seed({ journal: { '2026-10-28': 'Phone only' } });
  const user = renderApp();
  await user.click(screen.getByRole('button', { name: 'Sync with Google Drive' }));
  await user.click(await screen.findByRole('button', { name: /Sign in with Google/ }));
  expect(await screen.findByText(/Google Drive already has Kaizen data/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sync needs attention' })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText(/Last synced just now/);
  expect(screen.getByTestId('journal')).toHaveTextContent('From the laptop');
  expect(screen.getByTestId('journal')).not.toHaveTextContent('Phone only');
  expect(JSON.parse(window.localStorage.getItem(`${KEY}.before-sync`)).journal).toEqual({ '2026-10-28': 'Phone only' });
});

test('when Google access runs out, sync waits for a tap and nothing is lost', async () => {
  const user = renderApp();
  await turnOn(user);

  fake.expired = true;
  await user.click(screen.getByText('note'));
  expect(await screen.findByText('Google sign-in has run out')).toBeInTheDocument();
  expect(driveHas('Drink water')).toBe(false);

  await user.click(screen.getByRole('button', { name: 'Continue syncing' }));
  await screen.findByText(/Last synced just now/);
  expect(driveHas('Drink water')).toBe(true);
});

test('if the app\'s data vanishes all at once, that is not synced as deleting everything', async () => {
  seed({ notes: [{ id: 1, day: 'mon', content: 'one' }, { id: 2, day: 'tue', content: 'two' }], journal: { '2026-10-27': 'kept' } });
  const user = renderApp();
  await turnOn(user);

  await user.click(screen.getByText('wipe'));
  // The next sync takes everything back from Drive instead.
  await waitFor(() => expect(screen.getByTestId('notes')).toHaveTextContent('one,two'));
  expect(screen.getByTestId('journal')).toHaveTextContent('kept');
  expect(driveHas('"one"')).toBe(true);
});

test('a wipe is caught even when there are only journal entries (no timers or notes)', async () => {
  seed({ journal: { '2026-10-26': 'one', '2026-10-27': 'two' } });
  const user = renderApp();
  await turnOn(user);

  await user.click(screen.getByText('wipe'));
  await waitFor(() => expect(screen.getByTestId('journal')).toHaveTextContent('two'));
  expect(screen.getByTestId('journal')).toHaveTextContent('one');
  expect(allText()).toContain('"one"');
});

test('a change made while a sync is on its way is kept, and sent right after', async () => {
  seed({ journal: { '2026-10-26': 'first' } });
  const user = renderApp();
  await turnOn(user);

  // Hold the next upload until the user has written something.
  let release;
  fake.slow = () => new Promise((resolve) => (release = resolve));
  await user.click(screen.getByText('note'));
  await waitFor(() => expect(release).toBeDefined());
  await user.click(screen.getByText('write'));
  fake.slow = null;
  release();

  await waitFor(() => expect(allText()).toContain('Written here'));
  expect(allText()).toContain('Drink water');
  expect(screen.getByTestId('journal')).toHaveTextContent('Written here');
});

test('turning sync off keeps the data and signs out', async () => {
  const user = renderApp();
  await turnOn(user);
  await user.click(screen.getByRole('button', { name: 'Turn off sync' }));
  const title = await waitFor(() => {
    const found = [...document.querySelectorAll('.ant-modal-confirm-title')].filter((el) => /Turn off sync/.test(el.textContent));
    if (!found.length) throw new Error('no dialog yet');
    return found[found.length - 1];
  });
  const dialog = title.closest('[role="dialog"]');
  await user.click(within(dialog).getByRole('button', { name: 'Turn off' }));
  expect(await screen.findByRole('button', { name: /Sign in with Google/ })).toBeInTheDocument();
  expect(auth.token).toBeNull();
  expect(fake.files.size).toBe(1);
});

test('ago() reads like a person would say it', () => {
  const now = 10 * 24 * 3600 * 1000;
  expect(ago(null, now)).toBe('not yet');
  expect(ago(now - 20 * 1000, now)).toBe('just now');
  expect(ago(now - 5 * 60 * 1000, now)).toBe('5 min ago');
  expect(ago(now - 3 * 3600 * 1000, now)).toBe('3 h ago');
  expect(ago(now - 30 * 3600 * 1000, now)).toBe('yesterday');
});
