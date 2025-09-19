# Where's This Level Crossing?

A full-stack learning game that teaches children to recognise railway level crossings
around the world. The project includes a React + Redux front end packaged with Vite and
an Express/SQLite backend API. Capacitor can wrap the compiled web build for iOS and
Android.

## Structure

- `frontend/` – Vite + React app with Redux Toolkit, Framer Motion and Tailwind CSS.
- `backend/` – Express API with JWT auth, SQLite storage, and Google sign-in support.
- `scripts/` – Utility scripts for exporting crossing data and fetching flag assets.
- `scraper/` – Existing data collection tooling (unchanged).

## Getting started

1. Install dependencies:

   ```bash
   cd frontend && npm install
   cd ../backend && npm install
   ```

2. Prepare the database (optional demo seed):

   ```bash
   npm run migrate
   npm run seed
   ```

3. Start the backend:
2
   ```bash
   npm run dev
   ```

4. Start the frontend:

   ```bash
   cd frontend
   npm run dev
   ```

5. Build mobile bundles with Capacitor after a production build:

   ```bash
   npm run build
   npx cap copy
   npx cap add ios
   npx cap add android
   ```

## Data assets

- `scripts/export_crossings.mjs` reads `scraper/level_crossings.sqlite` plus the
  corresponding image files from `scraper/storage/` and copies them into the backend.
  It writes `backend/data/level_crossings.json` and mirrors the photos into
  `backend/public/crossings/`. Run it after the scraper completes:

  ```bash
  node scripts/export_crossings.mjs --target backend
  ```

  Pass `--target backend,frontend` if you also want to generate the legacy
  front-end bundle for offline or static builds.
- `scripts/fetch_flags.mjs` uses `curl` to download SVG country flags and saves them
  to `frontend/src/assets/flags_base64.json` as base64 data URIs. The script respects
  system proxy settings via `curl`.

The game now waits for the real crossing imagery to be exported. Until the backend
assets exist, the game route shows guidance for running the export script. The backend
serves the generated metadata at `GET /api/crossings` and the photos from
`/crossings/...`.
