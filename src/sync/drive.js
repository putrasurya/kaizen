// The sync files in the user's Google Drive, in the hidden app data folder:
// only Kaizen can see them, and Kaizen can't see anything else in the Drive
// (scope drive.appdata). Each device writes its own file and reads the
// others', so two devices never overwrite each other's upload.

const PREFIX = "kaizen-sync-";
export const syncFileName = (deviceId) => `${PREFIX}${deviceId}.json`;
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

// The access token is no longer valid: sign in again.
export class AuthError extends Error {}
// Anything else that went wrong talking to Drive (offline, server error...).
export class DriveError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Google's own explanation, e.g. "Google Drive API has not been used in
// project 123 before or it is disabled. Enable it by visiting ...".
async function reason(response) {
  let detail = "";
  try {
    const body = await response.json();
    detail = body?.error?.message ?? "";
  } catch {
    // No readable body.
  }
  return `Google Drive answered ${response.status}${detail ? `: ${detail}` : "."}`;
}

async function call(token, url, options = {}) {
  let response;
  try {
    response = await fetch(url, { ...options, headers: { Authorization: `Bearer ${token}`, ...options.headers } });
  } catch {
    throw new DriveError("Can't reach Google Drive. Check your connection.", 0);
  }
  if (response.status === 401) throw new AuthError("Signed out of Google.");
  if (!response.ok) throw new DriveError(await reason(response), response.status);
  return response;
}

const FIELDS = "id,name,createdTime,modifiedTime";

// Every device's sync file, oldest first.
export async function findSyncFiles(token) {
  const q = encodeURIComponent(`name contains '${PREFIX}' and trashed = false`);
  const files = [];
  let page = "";
  do {
    const response = await call(
      token,
      `${API}/files?spaces=appDataFolder&q=${q}&orderBy=createdTime&fields=nextPageToken,files(${FIELDS})&pageSize=100${page ? `&pageToken=${encodeURIComponent(page)}` : ""}`
    );
    const body = await response.json();
    files.push(...(body.files ?? []));
    page = body.nextPageToken ?? "";
  } while (page);
  return files.filter((file) => file.name?.startsWith(PREFIX));
}

export async function downloadSyncFile(token, id) {
  const response = await call(token, `${API}/files/${id}?alt=media`);
  try {
    return await response.json();
  } catch {
    // Damaged file: skipped (its device rewrites it on its next sync).
    return null;
  }
}

export async function createSyncFile(token, name, content) {
  const boundary = `kaizen-${Math.random().toString(36).slice(2)}`;
  const metadata = { name, parents: ["appDataFolder"], mimeType: "application/json" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(content)}\r\n--${boundary}--`;
  const response = await call(token, `${UPLOAD}/files?uploadType=multipart&fields=${FIELDS}`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return response.json();
}

export async function updateSyncFile(token, id, content) {
  const response = await call(token, `${UPLOAD}/files/${id}?uploadType=media&fields=${FIELDS}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content),
  });
  return response.json();
}

export async function deleteSyncFile(token, id) {
  await call(token, `${API}/files/${id}`, { method: "DELETE" });
}

// The signed-in account, to show who's syncing. Not essential.
export async function whoAmI(token) {
  try {
    const response = await call(token, `${API}/about?fields=user(emailAddress,displayName)`);
    const { user } = await response.json();
    return user?.emailAddress ?? user?.displayName ?? null;
  } catch (error) {
    if (error instanceof AuthError) throw error;
    return null;
  }
}
