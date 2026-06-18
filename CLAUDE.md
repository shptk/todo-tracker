# todo-tracker — repo conventions

Minimal personal web app: a **planner** (todo by day/week/month) and a
**mood tracker** (year view of 12 monthly calendars; each day a clickable
color box). Minimalism is a hard requirement — resist adding dependencies,
frameworks, or feature bloat.

## Stack

- **Vanilla TypeScript + Vite.** No UI framework. DOM is built with the tiny
  helper in `src/dom.ts` (`el()` / `clear()`).
- **State:** a single `Store` (`src/store.ts`) over `localStorage` (key
  `todo-tracker:v1`). Single-device, no backend, no accounts. Views subscribe
  to the store and re-render on change.

## Commands

Node is via nvm (v22). Run `nvm use` / source nvm first if `node` isn't found.

- `npm install` — install deps
- `npm run dev` — Vite dev server (base `/`)
- `npm run build` — `tsc` typecheck + Vite production build to `dist/`
  (base `/todo-tracker/`)
- `npm run preview` — serve the production build locally

## Deploy

GitHub Pages **project site** at `https://shptk.github.io/todo-tracker/`.
`vite.config.ts` sets `base: "/todo-tracker/"` for builds. CI in
`.github/workflows/deploy.yml` builds and deploys on push to `main`.
Enable Pages → Source: "GitHub Actions" in repo settings once.

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
