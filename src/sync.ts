import { store } from "./store";
import { authState, getToken, subscribeAuth } from "./auth";
import type { AppData } from "./types";

// Syncs the whole data document to a single file in the user's own Google Drive
// (drive.file scope). Strategy: last-write-wins by AppData.updatedAt — pull on
// sign-in / load, push (debounced) on local changes. localStorage stays the
// offline source of truth; Drive is the cross-device sync layer.
//
// NOTE (v1): last-write-wins is whole-document. Editing on two devices while
// offline means the later save wins. Fine for one-device-at-a-time use; a
// field-level merge can come later if needed.

const FILE_NAME = "todo-tracker.json";
const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const PUSH_DEBOUNCE_MS = 1500;

export type SyncStatus = "idle" | "syncing" | "synced" | "error" | "paused";

let fileId: string | null = null;
let pushTimer: number | undefined;
let suppressPush = false;
let busy = false;
let status: SyncStatus = "idle";
const statusListeners = new Set<(s: SyncStatus) => void>();

export function syncStatus(): SyncStatus {
  return status;
}
export function subscribeSync(fn: (s: SyncStatus) => void): () => void {
  statusListeners.add(fn);
  return () => statusListeners.delete(fn);
}
function setStatus(s: SyncStatus): void {
  status = s;
  statusListeners.forEach((fn) => fn(s));
}

async function findFileId(token: string): Promise<string | null> {
  const q = encodeURIComponent(`name='${FILE_NAME}' and trashed=false`);
  const r = await fetch(`${DRIVE}/files?q=${q}&spaces=drive&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error("Drive list failed");
  const j = (await r.json()) as { files?: { id: string }[] };
  return j.files?.[0]?.id ?? null;
}

async function readFile(token: string, id: string): Promise<AppData | null> {
  const r = await fetch(`${DRIVE}/files/${id}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  return (await r.json()) as AppData;
}

async function createFile(token: string, data: AppData): Promise<string> {
  const boundary = `tt${data.updatedAt}_${FILE_NAME.length}`;
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
    JSON.stringify({ name: FILE_NAME, mimeType: "application/json" }) +
    `\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n` +
    JSON.stringify(data) +
    `\r\n--${boundary}--`;
  const r = await fetch(`${UPLOAD}/files?uploadType=multipart&fields=id`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error("Drive create failed");
  return ((await r.json()) as { id: string }).id;
}

async function writeFile(token: string, id: string, data: AppData): Promise<void> {
  const r = await fetch(`${UPLOAD}/files/${id}?uploadType=media`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Drive update failed");
}

/** Pull the remote copy and reconcile (newer side wins). */
async function pull(): Promise<void> {
  if (busy) return;
  busy = true;
  setStatus("syncing");
  try {
    const token = await getToken();
    if (!token) {
      setStatus("paused");
      return;
    }
    if (!fileId) fileId = await findFileId(token);
    if (!fileId) {
      fileId = await createFile(token, store.exportData());
      setStatus("synced");
      return;
    }
    const remote = await readFile(token, fileId);
    if (remote) {
      const remoteAt = remote.updatedAt ?? 0;
      const localAt = store.dataUpdatedAt();
      if (remoteAt > localAt) {
        suppressPush = true;
        store.applyRemote(remote);
        suppressPush = false;
      } else if (remoteAt < localAt) {
        await writeFile(token, fileId, store.exportData());
      }
    }
    setStatus("synced");
  } catch {
    setStatus("error");
  } finally {
    busy = false;
  }
}

/** Push local data to Drive (creating the file if needed). */
async function push(): Promise<void> {
  setStatus("syncing");
  try {
    const token = await getToken();
    if (!token) {
      setStatus("paused");
      return;
    }
    if (!fileId) fileId = await findFileId(token);
    const data = store.exportData();
    if (fileId) await writeFile(token, fileId, data);
    else fileId = await createFile(token, data);
    setStatus("synced");
  } catch {
    setStatus("error");
  }
}

function schedulePush(): void {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => void push(), PUSH_DEBOUNCE_MS);
}

/** Wire sync to auth + store. Call once at startup. */
export function initSync(): void {
  subscribeAuth((s) => {
    if (s.status === "signed-in") {
      void pull();
    } else {
      fileId = null;
      window.clearTimeout(pushTimer);
      setStatus("idle");
    }
  });

  store.subscribe(() => {
    if (!suppressPush && authState().status === "signed-in") schedulePush();
  });

  if (authState().status === "signed-in") void pull();
}
