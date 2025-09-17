import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Router } from "express";
import crypto from "crypto";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, "../data/level_crossings.json");

let cached = { data: [], mtimeMs: 0 };
let missingLogged = false;

const loadCrossings = () => {
  try {
    const stats = fs.statSync(dataPath);
    if (stats.mtimeMs !== cached.mtimeMs) {
      const raw = fs.readFileSync(dataPath, "utf-8");
      const parsed = JSON.parse(raw);
      cached = {
        data: Array.isArray(parsed) ? parsed : [],
        mtimeMs: stats.mtimeMs,
      };
    }
    missingLogged = false;
  } catch (error) {
    if (error.code === "ENOENT") {
      if (!missingLogged) {
        console.warn(`Level crossings metadata not found at ${dataPath}`);
        missingLogged = true;
      }
    } else {
      console.error("Failed to read level crossings metadata", error);
    }
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

const pickCrossing = (data, lastCountries) => {
  if (!data.length) return null;
  // Filter out crossings whose country_code is in the recent list
  const excluded = new Set(lastCountries);
  let candidates = data.filter((c) => !excluded.has(c.country_code));
  // Fallback: if filtering removed everything, relax constraint
  if (!candidates.length) candidates = data;
  const picked = candidates[Math.floor(Math.random() * candidates.length)];
  return picked;
};

const updateRecentCountries = (session, countryCode) => {
  if (!countryCode) return;
  session.lastCountries.push(countryCode);
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
  const crossing = pickCrossing(data, session.lastCountries);
  if (!crossing) return res.status(404).json({ error: "No crossings available" });
  updateRecentCountries(session, crossing.country_code);
  res.json({
    crossing,
    recentCountries: session.lastCountries.slice(),
    recentLimit: RECENT_COUNTRY_LIMIT,
  });
});

// Optional endpoint to inspect session state (debug only) - could be removed in production
if (process.env.NODE_ENV !== "production") {
  router.get("/session/:id/debug", (req, res) => {
    const s = sessions.get(req.params.id);
    if (!s) return res.status(404).json({ error: "Session not found" });
    res.json({ lastCountries: s.lastCountries, updatedAt: s.updatedAt });
  });
}

export default router;
