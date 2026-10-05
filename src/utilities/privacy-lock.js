// Privacy lock: a 4-digit PIN that hides the app from someone who picks up
// the device. It hides the screen only; the data in localStorage is NOT
// encrypted (a 4-digit PIN is too small a key for that to mean much).
//
// The PIN itself is never stored: only a salted PBKDF2 hash. There's no
// account or server, so a forgotten PIN can't be recovered; the only way back
// in is erasing all data, which the user agrees to when setting it up.
//
// Stored apart from the app state, under `${VITE_STORAGEKEY}.lock`, so it's
// read before the app renders and survives app-state migrations.

export const PIN_LENGTH = 4;
export const ITERATIONS = 300000;
export const FREE_ATTEMPTS = 5;
const BASE_WAIT = 30 * 1000;
const MAX_WAIT = 15 * 60 * 1000;

export const RELOCK_OPTIONS = [
  { value: 0, label: "Immediately" },
  { value: 60 * 1000, label: "After 1 minute" },
  { value: 5 * 60 * 1000, label: "After 5 minutes" },
];
const RELOCK_VALUES = RELOCK_OPTIONS.map((option) => option.value);

const appKey = () => import.meta.env.VITE_STORAGEKEY;
export const lockKey = () => `${appKey()}.lock`;

export const isValidPin = (pin) => typeof pin === "string" && new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

export async function hashPin(pin, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return toBase64(bits);
}

// Compares every character, so the time taken doesn't hint at how close it was.
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createLock(pin, relockAfter = 0) {
  if (!isValidPin(pin)) throw new Error("PIN must be 4 digits");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    version: 1,
    salt: toBase64(salt),
    hash: await hashPin(pin, salt),
    iterations: ITERATIONS,
    relockAfter: RELOCK_VALUES.includes(relockAfter) ? relockAfter : 0,
    failures: 0,
    waitUntil: 0,
  };
}

export async function checkPin(lock, pin) {
  if (!lock || !isValidPin(pin)) return false;
  return sameText(await hashPin(pin, fromBase64(lock.salt), lock.iterations), lock.hash);
}

// After FREE_ATTEMPTS wrong PINs, each further one means a wait: 30 s, then
// doubling, up to 15 minutes. Saved, so reloading doesn't reset it.
export function withFailure(lock, now = Date.now()) {
  const failures = lock.failures + 1;
  const over = failures - FREE_ATTEMPTS;
  const waitUntil = over >= 0 ? now + Math.min(MAX_WAIT, BASE_WAIT * 2 ** over) : 0;
  return { ...lock, failures, waitUntil };
}

export const withSuccess = (lock) => ({ ...lock, failures: 0, waitUntil: 0 });

export const triesLeft = (lock) => Math.max(0, FREE_ATTEMPTS - lock.failures);

export function readLock() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(lockKey()));
    if (!raw || typeof raw.hash !== "string" || typeof raw.salt !== "string") return null;
    return {
      version: 1,
      salt: raw.salt,
      hash: raw.hash,
      iterations: Number.isInteger(raw.iterations) && raw.iterations > 0 ? raw.iterations : ITERATIONS,
      relockAfter: RELOCK_VALUES.includes(raw.relockAfter) ? raw.relockAfter : 0,
      failures: Number.isInteger(raw.failures) && raw.failures > 0 ? raw.failures : 0,
      waitUntil: Number.isFinite(raw.waitUntil) ? raw.waitUntil : 0,
    };
  } catch {
    return null;
  }
}

export function writeLock(lock) {
  try {
    if (lock) window.localStorage.setItem(lockKey(), JSON.stringify(lock));
    else window.localStorage.removeItem(lockKey());
  } catch {
    // Storage unavailable: the lock just won't persist.
  }
}

// "Forgot PIN": everything Kaizen keeps on this device, gone.
export function eraseAllData() {
  for (const key of [appKey(), `${appKey()}.backup`, `${appKey()}.before-import`, `${appKey()}.last-export`, lockKey()]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
