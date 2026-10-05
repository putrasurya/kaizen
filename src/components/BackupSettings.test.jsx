import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App';
import { StoreProvider, stateFromBackup, STATE_VERSION } from '../redux/store';
import { lockKey } from '../utilities/privacy-lock';

const KEY = import.meta.env.VITE_STORAGEKEY;

const current = {
  version: STATE_VERSION, timers: [], embeds: [],
  notes: [{ id: 1, day: 'tue', content: 'Call mum' }],
  todos: [{ id: 1, day: 'tue', text: 'Groceries', doneOn: null }],
  habits: [],
  journal: { '2026-10-05': 'Current diary' },
};
const other = {
  ...current,
  todos: [{ id: 7, day: 'mon', text: 'From backup', doneOn: null }, { id: 8, day: 'mon', text: 'Second', doneOn: null }],
  journal: { '2026-09-01': 'Old diary' },
};
const backupFile = (data, extra = {}) =>
  new File([JSON.stringify({ app: 'kaizen', format: 1, exportedAt: '2026-10-01T02:00:00.000Z', data, ...extra })], 'kaizen-backup.json', { type: 'application/json' });

let blobs;
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 9, 6, 9, 0));
  window.localStorage.setItem(KEY, JSON.stringify(current));
  blobs = [];
  URL.createObjectURL = vi.fn((blob) => { blobs.push(blob); return 'blob:kaizen'; });
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.useRealTimers());

async function openBackup() {
  const user = userEvent.setup();
  render(<StoreProvider><App /></StoreProvider>);
  await user.click(screen.getByRole('button', { name: 'Backup & restore' }));
  const dialog = await screen.findByRole('dialog', { name: 'Backup & restore' });
  return { user, dialog };
}

function chooseFile(dialog, file) {
  fireEvent.change(within(dialog).getByLabelText('Backup file'), { target: { files: [file] } });
}

test('download: file content, name and "last backup" note', async () => {
  const { user, dialog } = await openBackup();
  expect(within(dialog).getByTestId('last-backup')).toHaveTextContent('Never backed up on this device.');

  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  await user.click(within(dialog).getByRole('button', { name: /Download backup/ }));

  expect(click).toHaveBeenCalledTimes(1);
  expect(click.mock.contexts[0].download).toBe('kaizen-backup-2026-10-06.json');
  const saved = JSON.parse(await blobs[0].text());
  expect(saved).toMatchObject({ app: 'kaizen', format: 1, data: { todos: current.todos, journal: current.journal } });
  expect(JSON.stringify(saved)).not.toContain('hash');
  expect(within(dialog).getByTestId('last-backup')).toHaveTextContent('Last backup: today');
  click.mockRestore();
});

test('restoring keeps the privacy lock as it is', async () => {
  const lock = JSON.stringify({ hash: 'h', salt: 's', relockAfter: 0, failures: 0, waitUntil: 0 });
  window.localStorage.setItem(lockKey(), lock);
  const { stateFromBackup: parse } = await import('../redux/store');
  expect(JSON.stringify(parse(JSON.stringify({ app: 'kaizen', format: 1, data: other })).state)).not.toContain('"hash"');
  expect(window.localStorage.getItem(lockKey())).toBe(lock);
});

test('restore shows what\'s in the file, then replaces everything after confirming', async () => {
  const { user, dialog } = await openBackup();
  chooseFile(dialog, backupFile(other));

  expect(await within(dialog).findByText(/2 todos, 0 habits, 1 journal entry, 1 reminder/)).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(KEY)).todos).toEqual(current.todos);

  await user.click(within(dialog).getByRole('button', { name: 'Replace my data' }));
  expect(within(dialog).getByText('Restored from backup.')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem(KEY))).toMatchObject({ todos: other.todos, journal: other.journal });
  expect(JSON.parse(window.localStorage.getItem(`${KEY}.before-import`)).journal).toEqual(current.journal);

  await user.click(within(dialog).getByRole('button', { name: 'Undo' }));
  expect(JSON.parse(window.localStorage.getItem(KEY))).toMatchObject({ todos: current.todos, journal: current.journal });
  expect(window.localStorage.getItem(`${KEY}.before-import`)).toBeNull();
});

test('cancelling a restore changes nothing', async () => {
  const { user, dialog } = await openBackup();
  chooseFile(dialog, backupFile(other));
  await user.click(await within(dialog).findByRole('button', { name: 'Cancel' }));
  expect(JSON.parse(window.localStorage.getItem(KEY)).todos).toEqual(current.todos);
  expect(within(dialog).getByRole('button', { name: /Choose backup file/ })).toBeInTheDocument();
});

test.each([
  ['not JSON', new File(['hello'], 'notes.txt'), "This file isn't a Kaizen backup (it couldn't be read)."],
  ['some other JSON', new File([JSON.stringify({ todos: [] })], 'x.json'), "This file isn't a Kaizen backup."],
  ['a newer version', backupFile({ ...other, version: STATE_VERSION + 1 }), 'This backup is from a newer version of Kaizen. Update the app and try again.'],
])('rejects %s with a clear message', async (_, file, message) => {
  const { dialog } = await openBackup();
  chooseFile(dialog, file);
  expect(await within(dialog).findByText(message)).toBeInTheDocument();
  expect(within(dialog).queryByRole('button', { name: 'Replace my data' })).not.toBeInTheDocument();
});

test('an older backup is upgraded on the way in', () => {
  const v3 = { version: 3, timers: [], notes: [{ id: 1, day: 'mon', content: 'x' }], todos: [], embeds: [] };
  const text = JSON.stringify({ app: 'kaizen', format: 1, data: v3 });
  const { state } = stateFromBackup(text, 'tue');
  expect(state).toMatchObject({ version: STATE_VERSION, habits: [], journal: {} });
  expect(state.notes).toEqual(v3.notes);
});

test('after restoring, every section shows the restored data straight away', async () => {
  const { user, dialog } = await openBackup();
  expect(screen.getByRole('textbox', { name: /^Journal for /, hidden: true })).toHaveValue('');
  chooseFile(dialog, backupFile({ ...other, journal: { '2026-10-06': 'From the backup' } }));
  await user.click(await within(dialog).findByRole('button', { name: 'Replace my data' }));

  expect(screen.getByRole('textbox', { name: /^Journal for /, hidden: true })).toHaveValue('From the backup');
  expect(within(dialog).getByText('Restored from backup.')).toBeInTheDocument();
});
