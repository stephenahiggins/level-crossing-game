import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import crypto from "crypto";
import Database from "better-sqlite3";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// We now use the SQLite DB produced by the scraper. It was moved to backend/db/level_crossings_data.sqlite
// Keep this separate from the auth/scores DB (level_crossings.db) to avoid
// mixing scraped content with application tables. If desired later, they can be merged.
const crossingsDbPath = path.resolve(__dirname, "../db/level_crossings_data.sqlite");
let crossingsDb;
try {
  if (!fs.existsSync(crossingsDbPath)) {
    console.warn(
      `[crossings] SQLite file not found at ${crossingsDbPath}. Endpoints will return empty data.`
    );
  } else {
    crossingsDb = new Database(crossingsDbPath, { readonly: true });
  }
} catch (e) {
  console.error("Failed to open crossings SQLite DB", e);
}

// Simple in-memory cache of all crossings (ids + url + country_code) refreshed on file mtime change.
// This keeps behavior similar to prior JSON hot-reload while relying on DB storage.
let cached = { data: [], mtimeMs: 0 };
const loadCrossings = () => {
  if (!crossingsDbPath || !crossingsDb) return [];
  try {
    const stats = fs.statSync(crossingsDbPath);
    if (stats.mtimeMs !== cached.mtimeMs) {
      const rawRows = crossingsDb
        .prepare(
          "SELECT id, url, country_code FROM level_crossings WHERE url IS NOT NULL AND country_code IS NOT NULL"
        )
        .all();
      const rows = rawRows.map((r) => {
        // The scraper stores file paths like 'storage/img_123.jpg'. We serve static files under '/crossings'.
        // If url already looks like '/crossings/...', leave it; else rewrite 'storage/' prefix.
        let rewritten = r.url;
        if (rewritten.startsWith("storage/")) {
          rewritten = "/crossings/" + rewritten.substring("storage/".length);
        } else if (!rewritten.startsWith("/crossings/")) {
          // Fallback: if it's just 'img_123.jpg' or some other relative path
          const base = path.basename(rewritten);
          rewritten = "/crossings/" + base;
        }
        return { id: r.id, url: rewritten, country_code: r.country_code };
      });
      cached = { data: rows, mtimeMs: stats.mtimeMs };
      if (process.env.NODE_ENV !== "production") {
        console.log(`[crossings] Reloaded ${rows.length} crossings from SQLite`);
      }
    }
  } catch (e) {
    console.error("Failed to load crossings from SQLite", e);
    cached = { data: [], mtimeMs: 0 };
  }
  return cached.data;
};

router.get("/", (req, res) => {
  const data = loadCrossings();
  res.json(data);
});

// ---------------- Game Session Logic ----------------
// We keep lightweight in-memory sessions for "timed" gameplay mode.
// A session tracks the last N (5) country codes used so we can avoid
// repeating the same country's crossing too soon.
// Sessions are ephemeral (reset on server restart) and expire after inactivity.
const SESSION_TTL_MS = 10 * 60 * 1000; // 10 minutes idle timeout
const RECENT_COUNTRY_LIMIT = 5;
const sessions = new Map(); // id -> { lastCountries: string[], updatedAt: number }

const touchSession = (id) => {
  const now = Date.now();
  const s = sessions.get(id) || { lastCountries: [], updatedAt: now };
  s.updatedAt = now;
  sessions.set(id, s);
  return s;
};

// Periodic cleanup (lazy on each request to avoid interval complexity)
const cleanupSessions = () => {
  const now = Date.now();
  for (const [id, s] of sessions.entries()) {
    if (now - s.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
};

// Strict picker: never repeat the same country consecutively if any alternative country exists.
const pickCrossing = (data, session) => {
  if (!data.length) return null;
  const lastCountries = Array.isArray(session) ? session : session.lastCountries || [];
  const lastCountry = lastCountries[lastCountries.length - 1];

  // Group crossings by country
  const byCountry = new Map();
  for (const row of data) {
    if (!row.country_code) continue;
    if (!byCountry.has(row.country_code)) byCountry.set(row.country_code, []);
    byCountry.get(row.country_code).push(row);
  }
  const countries = Array.from(byCountry.keys());
  if (!countries.length) return null;

  // If only one distinct country, must allow repeat.
  let candidateCountries = countries;
  if (countries.length > 1 && lastCountry) {
    const filtered = countries.filter((c) => c !== lastCountry);
    if (filtered.length) candidateCountries = filtered;
  }

  const pickedCountry = candidateCountries[Math.floor(Math.random() * candidateCountries.length)];
  const pool = byCountry.get(pickedCountry);
  return pool[Math.floor(Math.random() * pool.length)];
};

const updateRecentCountries = (session, countryCode) => {
  if (!countryCode) return;
  session.lastCountries.push(countryCode);
  session.countryCounts = session.countryCounts || {};
  session.countryCounts[countryCode] = (session.countryCounts[countryCode] || 0) + 1;
  if (session.lastCountries.length > RECENT_COUNTRY_LIMIT) {
    session.lastCountries.splice(0, session.lastCountries.length - RECENT_COUNTRY_LIMIT);
  }
};

// Start a new timed session. Returns a sessionId the client must send back.
router.post("/session", (req, res) => {
  cleanupSessions();
  const id = crypto.randomUUID();
  touchSession(id); // initializes session
  res.status(201).json({ sessionId: id, recentLimit: RECENT_COUNTRY_LIMIT });
});

// Get next crossing for the session with recent-country exclusion.
router.get("/session/:id/next", (req, res) => {
  cleanupSessions();
  const data = loadCrossings();
  const session = touchSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const crossing = pickCrossing(data, session);
  if (!crossing) return res.status(404).json({ error: "No crossings available" });
  updateRecentCountries(session, crossing.country_code);
  res.json({
    crossing,
    recentCountries: session.lastCountries.slice(),
    recentLimit: RECENT_COUNTRY_LIMIT,
    // Expose lightweight balance info (counts) for potential client-side debugging (omit in production if noisy)
    countryCounts: process.env.NODE_ENV !== "production" ? session.countryCounts : undefined,
  });
});

// Optional endpoint to inspect session state (debug only) - could be removed in production
if (process.env.NODE_ENV !== "production") {
  router.get("/session/:id/debug", (req, res) => {
    const s = sessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: "Session not found" });
    res.json({ lastCountries: s.lastCountries, updatedAt: s.updatedAt });
  });

  // Dev helper: simulate N picks to verify no immediate repeats.
  router.get("/session/:id/simulate/:n", (req, res) => {
    const n = Math.min(500, Math.max(1, parseInt(req.params.n, 10) || 0));
    const data = loadCrossings();
    const session = touchSession(req.params.id);
    const picks = [];
    let consecutiveRepeat = false;
    for (let i = 0; i < n; i++) {
      const crossing = pickCrossing(data, session);
      if (!crossing) break;
      if (
        session.lastCountries[session.lastCountries.length - 1] === crossing.country_code &&
        session.lastCountries.length
      ) {
        // (Should not happen unless only one country exists)
        consecutiveRepeat = true;
      }
      updateRecentCountries(session, crossing.country_code);
      picks.push(crossing.country_code);
    }
    res.json({ picks, consecutiveRepeat, uniqueCountries: [...new Set(picks)].length });
  });
}

export default router;
