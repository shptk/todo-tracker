# todo-tracker — repo conventions

Minimal personal web app: a **planner** (todo by day/week/month) and a
**mood tracker** (year view of 12 monthly calendars; each day a clickable
color box). Minimalism is a hard requirement — resist adding dependencies,
frameworks, or feature bloat.

## Stack

- **Vanilla TypeScript + Vite.** No UI framework. DOM is built with the tiny
  helper in `src/dom.ts` (`el()` / `clear()`).
- **State:** a single `Store` (`src/store.ts`) over `localStorage` (key
  `todo-tracker:v1`). Views subscribe to the store and re-render on change.
  localStorage is the offline source of truth; optional Google Drive sync
  (`src/sync.ts`) layers cross-device sync on top when signed in (no backend —
  each user's data lives in their own Drive).

## Commands

Node is via nvm (v22). Run `nvm use` / source nvm first if `node` isn't found.

- `npm install` — install deps
- `npm run dev` — Vite dev server (base `/`)
- `npm run build` — `tsc` typecheck + Vite production build to `dist/`
  (base `/todo-tracker/`)
- `npm run preview` — serve the production build locally

## Deploy

**GitHub Pages** from the public repo `shptk/todo-tracker`, served at the
custom subdomain **`https://tracker.shashwat.de/`**.

- Repo is **public** (MIT licensed), so free GitHub Pages applies.
- CI in `.github/workflows/deploy.yml` builds on push to `main` and deploys via
  the Pages Actions flow (Node pinned by `.node-version`). One-time: repo
  Settings → Pages → Source = "GitHub Actions".
- `public/CNAME` holds `tracker.shashwat.de` so it ships in `dist/` — that sets
  the custom domain. DNS: a `CNAME` record `tracker` → `shptk.github.io`.
  HTTPS provisions automatically.
- `vite.config.ts` sets `base: "/"` (the site is served at the subdomain root).
  If the host/path ever changes, update `base` accordingly.

## PWA

Installable via `vite-plugin-pwa` (config in `vite.config.ts`): generates the
web manifest + a Workbox service worker that precaches the static app for
offline use. `registerType: "autoUpdate"`. Icons live in `public/`
(`pwa-192x192.png`, `pwa-512x512.png`, `apple-touch-icon.png`, `icon.svg`) and
are regenerated from `public/icon.svg` with `rsvg-convert`. Installable from
Chrome once served over HTTPS (the Pages deploy) or on localhost for testing.
`devOptions.enabled` registers the SW on the dev server too.

## Layout

- `src/types.ts` — domain model (`Task`, `Mood`, `AppData`).
- `src/store.ts` — persistence + mutations + pub/sub.
- `src/moods.ts` — fixed mood palette + cycle logic.
- `src/dates.ts` — local date/week/month key helpers (ISO week, Mon-start).
- `src/planner.ts` — planner view (day/week/month sub-views). Exports `View`.
- `src/mood.ts` — mood tracker: Year view (12 mini calendars) + zoomed Month
  view, with date numbers in every box. Click a day to cycle its mood; in the
  Month view it also focuses that day's note. Day + month notes render here too.
- `src/notes.ts` — independent day/week/month note editor.
- `src/datamenu.ts` — footer Export/Import: download all data as JSON, or
  replace it from a backup file. Lets the user move data between devices
  (there is no backend/sync). Import reuses `store`'s `normalize()`.
- `src/notebook.ts` — notetaker: a flat list of standalone titled notes
  (`AppData.notebook: Note[]`), separate from the date-scoped notes. List /
  rendered-read / Markdown-edit modes; task checkboxes are clickable.
- `src/markdown.ts` — tiny zero-dependency Markdown renderer + task-checkbox
  toggle. HTML-escapes all input. Supports headings, bold/italic, code,
  bullet/ordered/task lists, quotes, rules, links. No dependency by design.
- `src/auth.ts` — Google sign-in via Google Identity Services (OAuth token flow,
  `drive.file` scope). Local-first/optional: app works signed-out. Paste the
  public OAuth **Client ID** at the top (`CLIENT_ID`) to enable it; until then
  the UI shows a "not configured" note. Exposes `getToken()` for the (upcoming)
  Drive sync layer.
- `src/account.ts` — header account button + login modal (the "login page").
- `src/sync.ts` — Google Drive sync: finds/creates `todo-tracker.json` in the
  user's Drive, pulls on sign-in/load, pushes (debounced) on change. Whole-doc
  last-write-wins by `AppData.updatedAt`. Surfaces a `SyncStatus`.
- `src/main.ts` — app shell + top-level tab routing via `location.hash`.

## Conventions / gotchas

- `verbatimModuleSyntax` is on — import types with `import type` (or inline
  `type` specifiers), never as value imports.
- **Notes are independent per scope** — day/week/month notes do NOT roll up.
- Mood palette is fixed: green=good, red=angry, gray=sad, amber=anxious,
  blue=calm, purple=tired. To add a mood: add the key in `types.ts` and an
  entry in `moods.ts` — the year view and cycle logic pick it up.
- Adding a new **tracker** later: store it under `AppData.trackers.<name>`
  alongside `mood`, add a view module, register a tab in `main.ts`.
- Date keys are derived from **local** time, not UTC, so a "day" matches the
  user's wall clock.
