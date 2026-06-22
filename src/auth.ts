// Google sign-in via Google Identity Services (GIS), OAuth token flow.
// Local-first: the app works fully signed-out; signing in only adds Drive sync.
//
// SETUP: paste your Google OAuth *Web* Client ID below. It's free (Google Cloud
// console → APIs & Services → Credentials) and is PUBLIC — safe to commit.
// Authorized JavaScript origins must include http://localhost:5173 (dev) and
// your deployed origin. Until this is set, the UI shows a "not configured" note.
const CLIENT_ID: string = "154320784701-fh1mvscaqdvttp1a0kk091uisa5m83eb.apps.googleusercontent.com";

// drive.file = per-file access (non-sensitive); openid/email/profile to show who
// is signed in. The app can only ever touch files it creates in the user's Drive.
const SCOPES = "openid email profile https://www.googleapis.com/auth/drive.file";
const AUTH_KEY = "todo-tracker:auth";
const TOKEN_KEY = "todo-tracker:token";

export interface Profile {
  email: string;
  name: string;
  picture: string;
}

export type AuthState =
  | { status: "signed-out"; profile: null }
  | { status: "signed-in"; profile: Profile };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gsi = () => (window as unknown as { google?: any }).google;

let state: AuthState = loadPersisted();
const listeners = new Set<(s: AuthState) => void>();
let accessToken: string | null = null;
let tokenExpiry = 0;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tokenClient: any = null;
let gisReady: Promise<void> | null = null;

// Cache the short-lived Drive access token across reloads. GIS's OAuth token
// flow has no hidden-iframe refresh — every acquisition opens a popup that
// auto-closes once Google confirms the session, so without a cache a page
// reload would flash that popup every time. The token is scope-limited
// (drive.file) and expires within ~1h; it lives alongside the rest of this
// local-first app's localStorage state.
loadPersistedToken();

function loadPersisted(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p?.email) return { status: "signed-in", profile: p };
    }
  } catch {
    /* ignore */
  }
  return { status: "signed-out", profile: null };
}

function persist(): void {
  if (state.status === "signed-in") localStorage.setItem(AUTH_KEY, JSON.stringify(state.profile));
  else localStorage.removeItem(AUTH_KEY);
}

function loadPersistedToken(): void {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as { token?: string; expiry?: number };
    if (p?.token && typeof p.expiry === "number" && Date.now() < p.expiry) {
      accessToken = p.token;
      tokenExpiry = p.expiry;
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

function persistToken(): void {
  try {
    if (accessToken && Date.now() < tokenExpiry) {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ token: accessToken, expiry: tokenExpiry }));
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

function set(next: AuthState): void {
  state = next;
  persist();
  listeners.forEach((fn) => fn(state));
}

export function isConfigured(): boolean {
  return CLIENT_ID !== "";
}

export function authState(): AuthState {
  return state;
}

export function subscribeAuth(fn: (s: AuthState) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function loadGis(): Promise<void> {
  if (gisReady) return gisReady;
  gisReady = new Promise((resolve, reject) => {
    if (gsi()?.accounts?.oauth2) return resolve();
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Google sign-in (are you offline?)."));
    document.head.append(s);
  });
  return gisReady;
}

async function ensureTokenClient(): Promise<void> {
  await loadGis();
  if (!tokenClient) {
    tokenClient = gsi().accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: () => {},
    });
  }
}

function requestToken(prompt?: string): Promise<string> {
  return ensureTokenClient().then(
    () =>
      new Promise<string>((resolve, reject) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tokenClient.callback = (resp: any) => {
          if (resp?.access_token) {
            accessToken = resp.access_token;
            tokenExpiry = Date.now() + (resp.expires_in ?? 3600) * 1000 - 60_000;
            persistToken();
            resolve(resp.access_token);
          } else {
            reject(new Error(resp?.error ?? "Authorization failed."));
          }
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tokenClient.error_callback = (err: any) =>
          reject(new Error(err?.message ?? "Sign-in was cancelled."));
        tokenClient.requestAccessToken(prompt === undefined ? {} : { prompt });
      }),
  );
}

async function fetchProfile(token: string): Promise<Profile> {
  const r = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Couldn't read your Google profile.");
  const j = (await r.json()) as { email: string; name?: string; picture?: string };
  return { email: j.email, name: j.name ?? j.email, picture: j.picture ?? "" };
}

export async function signIn(): Promise<void> {
  if (!isConfigured()) throw new Error("Google sign-in isn't configured yet.");
  const token = await requestToken();
  set({ status: "signed-in", profile: await fetchProfile(token) });
}

export async function signOut(): Promise<void> {
  const g = gsi();
  if (accessToken && g?.accounts?.oauth2?.revoke) {
    try {
      g.accounts.oauth2.revoke(accessToken, () => {});
    } catch {
      /* ignore */
    }
  }
  accessToken = null;
  tokenExpiry = 0;
  persistToken();
  set({ status: "signed-out", profile: null });
}

/**
 * Current access token for Drive calls. `interactive=false` (default) refreshes
 * silently (prompt=none) and returns null if a popup would be needed — so the
 * sync layer never triggers a surprise sign-in window on load.
 */
export async function getToken(interactive = false): Promise<string | null> {
  if (!isConfigured()) return null;
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  try {
    return await requestToken(interactive ? undefined : "none");
  } catch {
    return null;
  }
}
