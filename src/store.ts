import type { AppData, MoodKey, Note, NoteScope, Task } from "./types";

const STORAGE_KEY = "todo-tracker:v1";
const CURRENT_VERSION = 1;

function emptyData(): AppData {
  return {
    version: CURRENT_VERSION,
    updatedAt: 0,
    tasks: [],
    trackers: { mood: {} },
    notes: { day: {}, week: {}, month: {} },
    notebook: [],
  };
}

/** Merge an arbitrary parsed payload against an empty shell so older or
 *  partial data (and imported files) stay valid. */
function normalize(parsed: Partial<AppData> | null | undefined): AppData {
  const base = emptyData();
  if (!parsed || typeof parsed !== "object") return base;
  return {
    version: CURRENT_VERSION,
    updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : base.updatedAt,
    tasks: Array.isArray(parsed.tasks) ? parsed.tasks : base.tasks,
    trackers: { mood: parsed.trackers?.mood ?? base.trackers.mood },
    notes: {
      day: parsed.notes?.day ?? base.notes.day,
      week: parsed.notes?.week ?? base.notes.week,
      month: parsed.notes?.month ?? base.notes.month,
    },
    notebook: Array.isArray(parsed.notebook) ? parsed.notebook : base.notebook,
  };
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : emptyData();
  } catch {
    return emptyData();
  }
}

function newId(): string {
  // crypto.randomUUID is available in all modern browsers; fall back just in case.
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * The single source of truth. Mutations persist to localStorage immediately
 * and notify subscribers so views re-render. Single-device, no backend.
 */
class Store {
  private data: AppData = load();
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Persist to localStorage without notifying subscribers. `stamp` bumps the
   *  updatedAt clock (skipped when applying a remote copy during sync). */
  private write(stamp = true): void {
    if (stamp) this.data.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
  }

  /** Persist and notify subscribers so views re-render. */
  private commit(): void {
    this.write();
    this.listeners.forEach((fn) => fn());
  }

  // --- Sync support (Drive) ------------------------------------------------

  /** A deep copy of all data, for uploading to Drive. */
  exportData(): AppData {
    return structuredClone(this.data);
  }

  dataUpdatedAt(): number {
    return this.data.updatedAt ?? 0;
  }

  /**
   * Replace all data from a synced remote copy. Preserves the remote's
   * updatedAt (no restamp) so it doesn't immediately look newer and push back,
   * and notifies subscribers so views refresh.
   */
  applyRemote(data: AppData): void {
    const norm = normalize(data);
    norm.updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : Date.now();
    this.data = norm;
    this.write(false);
    this.listeners.forEach((fn) => fn());
  }

  // --- Tasks ---------------------------------------------------------------

  tasksForDay(key: string): Task[] {
    return this.data.tasks
      .filter((t) => t.date === key)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  addTask(date: string, text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.data.tasks.push({
      id: newId(),
      text: trimmed,
      done: false,
      date,
      createdAt: Date.now(),
    });
    this.commit();
  }

  toggleTask(id: string): void {
    const t = this.data.tasks.find((x) => x.id === id);
    if (!t) return;
    t.done = !t.done;
    this.commit();
  }

  editTask(id: string, text: string): void {
    const trimmed = text.trim();
    const t = this.data.tasks.find((x) => x.id === id);
    if (!t) return;
    if (!trimmed) {
      this.deleteTask(id);
      return;
    }
    t.text = trimmed;
    this.commit();
  }

  deleteTask(id: string): void {
    this.data.tasks = this.data.tasks.filter((x) => x.id !== id);
    this.commit();
  }

  /**
   * Set or clear a task's optional description. Persists WITHOUT notifying —
   * the textarea holds its own value, so a re-render would steal focus while
   * typing (same rationale as setNote/updateNote).
   */
  setTaskDesc(id: string, desc: string): void {
    const t = this.data.tasks.find((x) => x.id === id);
    if (!t) return;
    if (desc.trim() === "") delete t.desc;
    else t.desc = desc;
    this.write();
  }

  // --- Mood tracker --------------------------------------------------------

  mood(key: string): MoodKey | undefined {
    return this.data.trackers.mood[key];
  }

  setMood(key: string, mood: MoodKey | undefined): void {
    if (mood === undefined) {
      delete this.data.trackers.mood[key];
    } else {
      this.data.trackers.mood[key] = mood;
    }
    this.commit();
  }

  // --- Notes ---------------------------------------------------------------

  note(scope: NoteScope, key: string): string {
    return this.data.notes[scope][key] ?? "";
  }

  setNote(scope: NoteScope, key: string, text: string): void {
    if (text.trim() === "") {
      delete this.data.notes[scope][key];
    } else {
      this.data.notes[scope][key] = text;
    }
    // Persist without notifying: the textarea holds its own value, so a
    // re-render here would only steal focus mid-typing.
    this.write();
  }

  // --- Notetaker (standalone titled notes) --------------------------------

  /** All notebook notes, most recently updated first. */
  allNotes(): Note[] {
    return [...this.data.notebook].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getNote(id: string): Note | undefined {
    return this.data.notebook.find((n) => n.id === id);
  }

  /** Create a new empty note and return it (notifies). */
  addNote(): Note {
    const now = Date.now();
    const note: Note = { id: newId(), title: "", body: "", createdAt: now, updatedAt: now };
    this.data.notebook.push(note);
    this.commit();
    return note;
  }

  /**
   * Patch a note's title and/or body. Persists WITHOUT notifying — the inputs
   * hold their own value, so a re-render here would steal focus mid-typing
   * (same rationale as setNote).
   */
  updateNote(id: string, patch: { title?: string; body?: string }): void {
    const n = this.data.notebook.find((x) => x.id === id);
    if (!n) return;
    if (patch.title !== undefined) n.title = patch.title;
    if (patch.body !== undefined) n.body = patch.body;
    n.updatedAt = Date.now();
    this.write();
  }

  deleteNote(id: string): void {
    this.data.notebook = this.data.notebook.filter((n) => n.id !== id);
    this.commit();
  }

  // --- Backup (export / import) -------------------------------------------

  /** All data as pretty JSON, for download. */
  exportJSON(): string {
    return JSON.stringify(this.data, null, 2);
  }

  /**
   * Replace all data from an exported JSON string. Throws on invalid JSON;
   * unknown/partial fields are normalized to a valid shape. Notifies so views
   * re-render with the imported data.
   */
  importJSON(text: string): void {
    this.data = normalize(JSON.parse(text));
    this.commit();
  }
}

export const store = new Store();
