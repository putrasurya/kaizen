import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  checkPin,
  createLock,
  eraseAllData,
  readLock,
  triesLeft,
  withFailure,
  withSuccess,
  writeLock,
} from "../utilities/privacy-lock";

// Whether the privacy lock is on, whether the app is locked right now, and
// whether it's covered because the app is in the background.
//
// Leaving the app (switching apps, locking the phone) covers it straight away,
// so the app switcher's preview doesn't show anything. Coming back unlocks the
// cover, or asks for the PIN if the app was away for at least `relockAfter`.
// Opening or reloading the app always asks.
const privacyContext = createContext(null);

const reload = () => window.location.reload();

function PrivacyProvider({ children, onErase = reload }) {
  const [lock, setLock] = useState(() => readLock());
  const [locked, setLocked] = useState(() => !!readLock());
  const [covered, setCovered] = useState(false);
  const lockRef = useRef(lock);
  const hiddenAt = useRef(null);
  lockRef.current = lock;

  const save = useCallback((next) => {
    writeLock(next);
    lockRef.current = next;
    setLock(next);
  }, []);

  useEffect(() => {
    const hide = () => {
      if (!lockRef.current) return;
      if (hiddenAt.current === null) hiddenAt.current = Date.now();
      // Rendered synchronously, before the OS takes its app-switcher snapshot.
      flushSync(() => setCovered(true));
    };
    const show = () => {
      if (!lockRef.current || hiddenAt.current === null) return;
      if (Date.now() - hiddenAt.current >= lockRef.current.relockAfter) setLocked(true);
      hiddenAt.current = null;
      setCovered(false);
    };
    const onVisibility = () => (document.visibilityState === "hidden" ? hide() : show());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", hide);
    window.addEventListener("pageshow", show);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", hide);
      window.removeEventListener("pageshow", show);
    };
  }, []);

  // Checks a PIN, counting wrong ones towards the wait. While a wait is on,
  // nothing is checked at all.
  const attempt = useCallback(
    async (pin) => {
      const current = lockRef.current;
      if (!current) return { ok: true };
      if (current.waitUntil > Date.now()) return { ok: false, waitUntil: current.waitUntil, triesLeft: 0 };
      const ok = await checkPin(current, pin);
      const next = ok ? withSuccess(current) : withFailure(current);
      save(next);
      return { ok, waitUntil: next.waitUntil, triesLeft: triesLeft(next) };
    },
    [save]
  );

  const unlock = useCallback(
    async (pin) => {
      const result = await attempt(pin);
      if (result.ok) setLocked(false);
      return result;
    },
    [attempt]
  );

  const value = {
    enabled: !!lock,
    locked: !!lock && locked,
    covered: !!lock && covered,
    lock,
    attempt,
    unlock,
    enable: async (pin, relockAfter) => save(await createLock(pin, relockAfter)),
    // Callers confirm the current PIN with `attempt` first.
    changePin: async (pin) => save(await createLock(pin, lockRef.current?.relockAfter)),
    disable: () => save(null),
    setRelockAfter: (relockAfter) => lockRef.current && save({ ...lockRef.current, relockAfter }),
    lockNow: () => lockRef.current && setLocked(true),
    erase: () => {
      eraseAllData();
      onErase();
    },
  };

  return <privacyContext.Provider value={value}>{children}</privacyContext.Provider>;
}

const off = {
  enabled: false,
  locked: false,
  covered: false,
  lock: null,
  attempt: async () => ({ ok: true }),
  unlock: async () => ({ ok: true }),
  enable: async () => {},
  changePin: async () => {},
  disable: () => {},
  setRelockAfter: () => {},
  lockNow: () => {},
  erase: () => {},
};

// Outside a PrivacyProvider (a component rendered on its own) there's no lock.
function usePrivacy() {
  return useContext(privacyContext) ?? off;
}

export { PrivacyProvider, usePrivacy };
