import { checkPin, createLock, eraseAllData, isValidPin, lockKey, readLock, triesLeft, withFailure, withSuccess } from './privacy-lock';

const KEY = import.meta.env.VITE_STORAGEKEY;

test('a lock stores a salted hash, never the PIN, and checks it', async () => {
  const lock = await createLock('1234', 60000);
  expect(JSON.stringify(lock)).not.toContain('1234');
  expect(lock).toMatchObject({ relockAfter: 60000, failures: 0, waitUntil: 0 });
  expect(await checkPin(lock, '1234')).toBe(true);
  expect(await checkPin(lock, '1235')).toBe(false);
  expect(await checkPin(lock, '12345')).toBe(false);
});

test('the same PIN hashes differently each time (random salt)', async () => {
  const [a, b] = await Promise.all([createLock('0000'), createLock('0000')]);
  expect(a.hash).not.toBe(b.hash);
});

test('only 4-digit PINs are accepted', async () => {
  expect(isValidPin('0420')).toBe(true);
  for (const bad of ['123', '12345', '12a4', '', null]) expect(isValidPin(bad)).toBe(false);
  await expect(createLock('12')).rejects.toThrow();
});

test('5 wrong tries are free, then the waits double up to 15 minutes', () => {
  let lock = { failures: 0, waitUntil: 0 };
  const now = 1_000_000;
  for (let i = 0; i < 4; i++) lock = withFailure(lock, now);
  expect(lock).toMatchObject({ failures: 4, waitUntil: 0 });
  expect(triesLeft(lock)).toBe(1);

  lock = withFailure(lock, now);
  expect(lock.waitUntil - now).toBe(30 * 1000);
  lock = withFailure(lock, now);
  expect(lock.waitUntil - now).toBe(60 * 1000);
  for (let i = 0; i < 10; i++) lock = withFailure(lock, now);
  expect(lock.waitUntil - now).toBe(15 * 60 * 1000);

  expect(withSuccess(lock)).toMatchObject({ failures: 0, waitUntil: 0 });
});

test('readLock ignores missing or broken data and repairs odd fields', () => {
  expect(readLock()).toBeNull();
  window.localStorage.setItem(lockKey(), 'not json');
  expect(readLock()).toBeNull();
  window.localStorage.setItem(lockKey(), JSON.stringify({ hash: 'h', salt: 's', relockAfter: 7, failures: -2 }));
  expect(readLock()).toMatchObject({ hash: 'h', salt: 's', relockAfter: 0, failures: 0, iterations: 300000 });
});

test('erasing removes the app data, its backup and the lock', () => {
  for (const key of [KEY, `${KEY}.backup`, lockKey(), 'unrelated']) window.localStorage.setItem(key, 'x');
  eraseAllData();
  expect(window.localStorage.getItem(KEY)).toBeNull();
  expect(window.localStorage.getItem(`${KEY}.backup`)).toBeNull();
  expect(window.localStorage.getItem(lockKey())).toBeNull();
  expect(window.localStorage.getItem('unrelated')).toBe('x');
});
