// One sync: read the other devices' files on Drive, merge them into this
// device, apply the result here, and write this device's own file. Safe to
// repeat and safe to interrupt: merging is idempotent, so a sync cut off
// halfway is simply finished by the next one. Each device only ever writes
// its own file, so uploads can't overwrite each other.
import { syncFileName } from "./drive";
import { emptyMeta, merge, preferLarger, toShared } from "./engine";

export const SYNC_APP = "kaizen-sync";
export const SYNC_FORMAT = 1;
// Files of devices that haven't synced for this long are folded into this
// device's file and removed, so old phones and reinstalls don't pile up.
export const RETIRE_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

export const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const isSyncDoc = (doc) => !!doc && doc.app === SYNC_APP && typeof doc.cells === "object" && !!doc.cells;

export class SyncSpaceError extends Error {}

// `local` is this device:
//   meta()                    its sync copy, up to date with the app state
//   hasData()                 whether the app has anything in it yet
//   keepCopy()                save the app data aside; false if it couldn't
//   commit(meta, { base, joined })
//                             show the merged data. `base` is what meta()
//                             returned: changes made here since then are kept
//                             on top (merged, or laid on with applyChanges
//                             when `joined`, as the result isn't built on base).
// `join` is the user's answer when this device and Drive both have data and
// haven't synced together before: "drive" (use Drive's) or "combine".
//
// Returns { status: "synced" | "needs-choice" | "update-app" }.
export async function syncOnce({ token, drive, local, stateVersion, join = null, now = () => Date.now() }) {
  const base = local.meta();
  const ownName = syncFileName(base.deviceId);
  const files = await drive.findSyncFiles(token);
  const own = files.filter((file) => file.name === ownName);
  // This device's own file is read too: it's how a device whose data was
  // wiped gets it back (merging what it already has changes nothing).
  const docs = [];
  for (const file of files) {
    const doc = await drive.downloadSyncFile(token, file.id);
    if (!isSyncDoc(doc)) continue;
    if (doc.format > SYNC_FORMAT || doc.stateVersion > stateVersion) return { status: "update-app" };
    docs.push({ file, doc });
  }

  // Drive's data belongs to the oldest file's generation (its epoch). Files
  // with another epoch are devices that haven't joined it yet (two devices
  // set up at the same moment): they're left out until they do, so nobody
  // takes in their data before they've chosen what to do with it.
  const epoch = docs[0]?.doc.epoch ?? null;
  const joined = docs.filter(({ doc }) => doc.epoch === epoch);
  let remote = null;
  if (joined.length) {
    const combined = joined.reduce((meta, { doc }) => merge(meta, doc), emptyMeta("drive"));
    remote = { ...toShared(combined), epoch };
  }

  let meta = base;
  let joining = false;
  if (remote && base.epoch !== remote.epoch) {
    const hasData = local.hasData();
    if (hasData && !join) return { status: "needs-choice" };
    if (hasData && !local.keepCopy()) {
      throw new SyncSpaceError("There isn't room on this device to keep a copy of its data first. Download a backup, then try again.");
    }
    // Joining isn't built on `base` (Drive's data, or counts adjusted by
    // "combine"), so changes made during the sync are laid on top separately.
    joining = true;
    meta = !hasData || join === "drive" ? { ...emptyMeta(base.deviceId), clock: base.clock } : preferLarger(base, remote);
    meta = { ...merge(meta, remote), epoch: remote.epoch };
  } else if (remote) {
    meta = merge(base, remote);
  } else if (!base.epoch) {
    meta = { ...base, epoch: newId() };
  }
  local.commit(meta, { base, joined: joining });

  const doc = {
    app: SYNC_APP,
    format: SYNC_FORMAT,
    stateVersion,
    epoch: meta.epoch,
    deviceId: base.deviceId,
    savedAt: new Date(now()).toISOString(),
    ...toShared(meta),
  };
  const [mine, ...duplicates] = own;
  let saved = false;
  if (mine) {
    try {
      await drive.updateSyncFile(token, mine.id, doc);
      saved = true;
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }
  if (!saved) await drive.createSyncFile(token, ownName, doc);
  for (const file of duplicates) await drive.deleteSyncFile(token, file.id);

  // Long-silent devices of this generation: everything in their files is
  // now in this one. Measured by Drive's clock (the newest change it has
  // seen), not this device's, which could be wrong. The oldest file stays:
  // it tells which generation Drive's data belongs to.
  const newest = Math.max(...files.map((file) => Date.parse(file.modifiedTime)).filter(Number.isFinite));
  for (const { file } of joined.slice(1)) {
    if (file.name === ownName) continue;
    const modified = Date.parse(file.modifiedTime);
    if (Number.isFinite(modified) && newest - modified > RETIRE_AFTER_MS) {
      await drive.deleteSyncFile(token, file.id).catch(() => {});
    }
  }
  return { status: "synced" };
}
