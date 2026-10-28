// Google sign-in with Google Identity Services (the token flow for apps with
// no server). An access token lasts about an hour and there's no refresh
// token without a server, so when it runs out the user taps to continue:
// browsers only allow the sign-in pop-up after a tap.

export const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const SCRIPT = "https://accounts.google.com/gsi/client";
const TOKEN_KEY = "kaizen.sync-token";
// Renew a little before Google says it expires.
const MARGIN_MS = 60 * 1000;

export const clientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
export const isConfigured = () => !!clientId();

let scriptPromise;
function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Couldn't load Google sign-in. Check your connection."));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

// The token is kept for this browser tab only (sessionStorage), so a reload
// within the hour doesn't ask again.
export function savedToken(now = Date.now()) {
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(TOKEN_KEY));
    if (saved?.token && saved.expiresAt - MARGIN_MS > now) return saved.token;
  } catch {
    // ignore
  }
  return null;
}

function saveToken(token, expiresIn) {
  try {
    window.sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiresAt: Date.now() + expiresIn * 1000 }));
  } catch {
    // ignore
  }
}

export function forgetToken() {
  try {
    window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // ignore
  }
}

// Opens Google's pop-up. Must be called from a tap. `hint` is the email used
// last time, so Google can skip the account picker.
export async function signIn(hint) {
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId(),
      scope: SCOPE,
      ...(hint ? { login_hint: hint } : {}),
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error_description || "Google sign-in didn't finish."));
          return;
        }
        if (!window.google.accounts.oauth2.hasGrantedAllScopes(response, SCOPE)) {
          reject(new Error("Kaizen needs permission to use its folder in your Google Drive."));
          return;
        }
        saveToken(response.access_token, Number(response.expires_in) || 3600);
        resolve(response.access_token);
      },
      error_callback: (error) =>
        reject(new Error(error?.type === "popup_closed" ? "Sign-in was closed before it finished." : "Google sign-in didn't open. Allow pop-ups and try again.")),
    });
    client.requestAccessToken({ prompt: hint ? "" : "consent" });
  });
}

// Signs out of Kaizen's access (not out of Google itself).
export async function signOut(token) {
  forgetToken();
  if (!token) return;
  try {
    await loadScript();
    window.google.accounts.oauth2.revoke(token, () => {});
  } catch {
    // Offline: the token simply runs out within the hour.
  }
}
