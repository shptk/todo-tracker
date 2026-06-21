// Domain model for the todo + mood-tracker app.
// Storage is single-device localStorage (see store.ts).

export type MoodKey =
  | "good"
  | "angry"
  | "sad"
  | "anxious"
  | "calm"
  | "tired";

export interface Mood {
  key: MoodKey;
  label: string;
  /** CSS color that fills the day box. */
  color: string;
  emoji: string;
}

export interface Task {
  id: string;
  text: string;
  done: boolean;
  /** The day this task is planned for, as an ISO date key (YYYY-MM-DD). */
  date: string;
  createdAt: number;
  /** Optional longer description / notes for the task. */
  desc?: string;
}

/**
 * Notes are independent per scope (not rolled up).
 *   day   -> keyed by YYYY-MM-DD
 *   week  -> keyed by YYYY-Www (ISO week)
 *   month -> keyed by YYYY-MM
 */
export type NoteScope = "day" | "week" | "month";

/**
 * A standalone titled note in the notetaker (distinct from the date-scoped
 * `notes` above). Free-form; the user can create any number of them.
 */
export interface Note {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  updatedAt: number;
}

export interface AppData {
  version: number;
  tasks: Task[];
  /**
   * The mood tracker. Keyed by ISO date (YYYY-MM-DD) -> mood key.
   * Kept under `trackers` so additional trackers can slot in alongside
   * mood later without reshaping existing data.
   */
  trackers: {
    mood: Record<string, MoodKey>;
  };
  notes: {
    day: Record<string, string>;
    week: Record<string, string>;
    month: Record<string, string>;
  };
  /** The notetaker: a flat list of standalone titled notes. */
  notebook: Note[];
}
