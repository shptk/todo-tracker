# todo · tracker

A minimal, fast personal web app with three parts:

- **Planner** — capture tasks and plan by **day / week / month**. Tasks can have
  an optional description (click a task to expand it).
- **Mood tracker** — a **year at a glance**: 12 monthly calendars where each day
  is a box you click to cycle through a fixed mood palette, plus a zoomed
  **month** view. Independent free-text notes per day, week, and month.
- **Notetaker** — a flat list of standalone titled notes written in **Markdown**
  (with clickable task checkboxes).

Live: **https://tools.pathak.uk/tracker**

## Features

- Day / week / month planning with quick add, complete, edit, delete
- Year + month mood views with a fixed palette (good · angry · sad · anxious ·
  calm · tired) and a color legend
- Markdown notetaker (headings, lists, task checkboxes, code, quotes, links)
- Light / dark theme (follows your OS, with a manual toggle)
- **Installable PWA** — works offline, add to home screen
- **JSON export / import** to move your data between devices by hand
- Optional **Google Drive sync** — sign in and your data lives in *your own*
  Google Drive (see Privacy)

## Privacy & data

Local-first: everything is stored in your browser's `localStorage` and the app
works fully **without signing in**. There is **no backend and no account to
create**.

If you sign in with Google (optional), the app syncs your data to a single
`todo-tracker.json` file in **your own Google Drive** using the `drive.file`
scope — it can only ever touch that one file, and the data is never sent to or
stored on any server. Sign out (or never sign in) and it stays purely local.

## Tech

- **Vanilla TypeScript + Vite** — no UI framework. DOM is built with a tiny
  `el()` helper; a single `Store` over `localStorage` drives the views.
- Zero-dependency Markdown renderer for the notetaker.
- PWA via `vite-plugin-pwa` (Workbox service worker + web manifest).

## Develop

Node 22 (via nvm). From the repo root:

```sh
nvm use            # or: source your nvm, then nvm install 22
npm install
npm run dev        # dev server (app is under the /tracker/ base path)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build locally
```

The app is served under the `/tracker/` base by default. For a root-path preview
(e.g. local hacking), override it: `VITE_BASE=/ npm run dev`.

To enable Google sign-in, set your public OAuth **Client ID** in `src/auth.ts`
and add your origin to the client's Authorized JavaScript origins. It's optional
— the app runs fine signed-out.

## Deploy

Hosted free on **GitHub Pages** under the `pathak.uk` umbrella
(`https://pathak.uk/tracker/`) and served at **`https://tools.pathak.uk/tracker`**
through a small Cloudflare Worker that routes each tool by path segment. Pushing
to `main` builds and deploys via GitHub Actions. See `CLAUDE.md` for the full
hosting model.

## License

[MIT](./LICENSE)
