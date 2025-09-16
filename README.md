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

- `scripts/export_crossings.mjs` converts the provided `level_crossings.sqlite` database
  and associated image storage into the JSON bundle and public assets consumed by the app.
- `scripts/fetch_flags.mjs` downloads base64-encoded country flags for offline use.

The front end ships with placeholder crossings and SVG flag avatars so the interface
works immediately.
