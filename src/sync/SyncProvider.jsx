import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { normalizeState, store, STATE_VERSION } from "../redux/store";
import * as drive from "./drive";
import { AuthError } from "./drive";
import { applyChanges, emptyMeta, hasData, itemCount, materialize, merge, recordLocal } from "./engine";
import { newId, syncOnce, SyncSpaceError } from "./cycle";
import { forgetToken, isConfigured, savedToken, signIn, signOut } from "./google-auth";

// Syncs the app with Google Drive while sync is on:
//   - when the app opens or comes back to the screen (at most every 30 s),
//   - a few seconds after a change worth sharing (and again right after a
//     sync that was already running when the change came),
//   - when the app goes to the background with changes not sent yet,
//   - every few minutes while it's open, to pick up other devices' changes.
// Signing in needs a tap (browsers block the pop-up otherwise), so when the
// hour-long Google access runs out, syncing waits for "Continue syncing".

const AFTER_CHANGE_MS = 4000;
const EVERY_MS = 3 * 60 * 1000;
const MIN_GAP_MS = 30 * 1000;

const appKey = () => import.meta.env.VITE_STORAGEKEY;
const settingsKey = () => `${appKey()}.sync`;
const metaKey = () => `${appKey()}.sync-meta`;
export const keptKey = () => `${appKey()}.before-sync`;

export function readStored(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key));
  } catch {
    return null;
  }
}

// Returns false if it couldn't be saved (storage full).
export function writeStored(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const isMeta = (meta) => !!meta && typeof meta.deviceId === "string" && !!meta.cells && !!meta.records;

// The sync copy that goes with a state the sync produced (see commit below).
const metaForState = new WeakMap();

const SyncContext = createContext({ configured: false, enabled: false, status: "off" });
export const useSync = () => useContext(SyncContext);

// status: "off" | "idle" | "syncing" | "needs-sign-in" | "needs-choice" |
//         "update-app" | "offline" | "error"
export function SyncProvider({ children, afterChangeMs = AFTER_CHANGE_MS }) {
  const { fullState, applySync } = useContext(store);
  const configured = isConfigured();
  const [settings, setSettings] = useState(() => readStored(settingsKey()) ?? { enabled: false, email: null, lastSyncedAt: null });
  const [status, setStatus] = useState(() => (settings.enabled ? (savedToken() ? "idle" : "needs-sign-in") : "off"));
  const [message, setMessage] = useState(null);
  const [hasKeptCopy, setHasKeptCopy] = useState(() => !!readStored(keptKey()));

  const enabled = configured && settings.enabled;
  const meta = useRef(isMeta(readStored(metaKey())) ? readStored(metaKey()) : null);
  const stateRef = useRef(fullState);
  stateRef.current = fullState;
  const running = useRef(false);
  const dirty = useRef(false);
  const lastTry = useRef(0);
  const later = useRef();
  const syncRef = useRef();
  // The copy worked out by the last sync's store update, until it's adopted.
  const fromSync = useRef(null);

  const saveSettings = useCallback((change) => {
    setSettings((current) => {
      const next = { ...current, ...change };
      writeStored(settingsKey(), next);
      return next;
    });
  }, []);

  const saveMeta = (next) => {
    meta.current = next;
    writeStored(metaKey(), next);
  };

  // Brings the sync copy up to date with `state`. Returns whether there's
  // something worth syncing.
  const recordNow = (state = stateRef.current) => {
    if (!meta.current) return false;
    const synced = metaForState.get(state);
    if (synced) {
      // This state came from a sync: its copy is already worked out.
      fromSync.current = null;
      if (synced !== meta.current) saveMeta(synced);
      return false;
    }
    if (fromSync.current) {
      // A state built on top of a synced one (a tap landed in the same
      // render): start from the synced copy, so only the tap is new here.
      saveMeta(fromSync.current);
      fromSync.current = null;
    }
    // Everything vanished at once (storage cleared or unreadable) while the
    // sync copy still had several things: never sync that as "delete
    // everything". Start over instead, so the next sync takes the data back
    // from Drive. (Changes are recorded one at a time, so deleting your last
    // item yourself goes from one thing to none and is a normal delete.)
    if (!hasData(state) && itemCount(materialize(meta.current)) > 1) {
      saveMeta({ ...emptyMeta(meta.current.deviceId), clock: meta.current.clock });
      return true;
    }
    const { meta: next, changed, shared } = recordLocal(meta.current, state);
    if (changed) saveMeta(next);
    return shared;
  };

  const sync = useCallback(
    async ({ interactive = false, join = null } = {}) => {
      if (!configured) return;
      if (running.current) {
        dirty.current = true;
        return;
      }
      if (!readStored(settingsKey())?.enabled && !interactive) return;
      running.current = true;
      dirty.current = false;
      lastTry.current = Date.now();
      clearTimeout(later.current);
      try {
        let token = savedToken();
        if (!token) {
          if (!interactive) {
            setStatus("needs-sign-in");
            return;
          }
          token = await signIn(readStored(settingsKey())?.email);
        }
        setStatus("syncing");
        setMessage(null);
        if (!meta.current) saveMeta(emptyMeta(newId()));
        const result = await syncOnce({
          token,
          drive,
          stateVersion: STATE_VERSION,
          join,
          local: {
            meta: () => {
              recordNow();
              return meta.current;
            },
            hasData: () => hasData(stateRef.current),
            keepCopy: () => {
              const kept = writeStored(keptKey(), stateRef.current);
              setHasKeptCopy(kept);
              return kept;
            },
            commit: (merged, { base, joined }) => {
              // Worked out inside the store's update from the very latest
              // state: changes made since `base` was taken stay on top. Pure,
              // so it's fine for React to run it twice.
              const at = Date.now();
              applySync((current) => {
                const after = recordLocal(base, current, at).meta;
                const next = joined ? applyChanges(merged, base, after) : { ...merge(after, merged), epoch: merged.epoch };
                const state = normalizeState(materialize(next));
                metaForState.set(state, next);
                fromSync.current = next;
                return state;
              });
            },
          },
        });
        if (result.status === "synced") {
          saveSettings({ lastSyncedAt: Date.now() });
          setStatus("idle");
        } else {
          setStatus(result.status);
        }
      } catch (error) {
        if (error instanceof AuthError) {
          forgetToken();
          setStatus("needs-sign-in");
        } else if (error?.status === 0) {
          setStatus("offline");
          setMessage(error.message);
        } else {
          setStatus("error");
          setMessage(error instanceof SyncSpaceError ? error.message : error?.message ?? "Something went wrong.");
        }
      } finally {
        running.current = false;
        // A change came in while this sync ran: send it now.
        if (dirty.current) {
          dirty.current = false;
          later.current = setTimeout(() => syncRef.current(), 0);
        }
      }
    },
    [configured, applySync, saveSettings] // eslint-disable-line react-hooks/exhaustive-deps
  );
  syncRef.current = sync;

  // Every change: record it, and sync shortly if it's worth sharing.
  useEffect(() => {
    if (!enabled) return;
    if (recordNow(fullState)) {
      dirty.current = true;
      clearTimeout(later.current);
      later.current = setTimeout(() => syncRef.current(), afterChangeMs);
    }
  }, [fullState, enabled, afterChangeMs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Opening, coming back, going to the background with unsent changes,
  // getting back online, and every few minutes.
  useEffect(() => {
    if (!enabled) return undefined;
    const soon = () => {
      if (document.visibilityState === "hidden") {
        if (dirty.current) syncRef.current();
        return;
      }
      if (Date.now() - lastTry.current < MIN_GAP_MS) return;
      syncRef.current();
    };
    soon();
    const every = setInterval(soon, EVERY_MS);
    document.addEventListener("visibilitychange", soon);
    window.addEventListener("online", soon);
    return () => {
      clearInterval(every);
      clearTimeout(later.current);
      document.removeEventListener("visibilitychange", soon);
      window.removeEventListener("online", soon);
    };
  }, [enabled]);

  const turnOn = useCallback(async () => {
    setMessage(null);
    let token;
    try {
      token = await signIn(settings.email);
    } catch (error) {
      setMessage(error.message);
      return;
    }
    let email = null;
    try {
      email = await drive.whoAmI(token);
    } catch {
      // Shown without the address.
    }
    saveSettings({ enabled: true, email });
    await syncRef.current({ interactive: true });
  }, [settings.email, saveSettings]);

  const turnOff = useCallback(async () => {
    clearTimeout(later.current);
    await signOut(savedToken());
    saveSettings({ enabled: false });
    setStatus("off");
    setMessage(null);
  }, [saveSettings]);

  const forgetKeptCopy = useCallback(() => {
    writeStored(keptKey(), null);
    setHasKeptCopy(false);
  }, []);

  const value = useMemo(
    () => ({
      configured,
      enabled,
      status: enabled ? status : "off",
      message,
      email: settings.email,
      lastSyncedAt: settings.lastSyncedAt,
      hasKeptCopy,
      keptCopy: () => readStored(keptKey()),
      forgetKeptCopy,
      syncNow: () => sync({ interactive: true }),
      choose: (join) => sync({ interactive: true, join }),
      turnOn,
      turnOff,
    }),
    [configured, enabled, status, message, settings.email, settings.lastSyncedAt, hasKeptCopy, forgetKeptCopy, sync, turnOn, turnOff]
  );

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}
