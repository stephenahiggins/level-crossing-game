// build_level_crossings_sqlite.mjs
// Node 18+ (has global fetch). Creates/updates a SQLite DB with level crossings.

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import WikimediaCommonsScraper from "./scrapers/wikimedia_commons.js";
import WikimediaScraper from "./scrapers/wikimedia_parql.js";

// ====== CONFIG ======
const DB_FILE = "level_crossings.sqlite";
const TABLE_NAME = "level_crossings";
const WIKIMEDIA_COMMONS_MAX = 20000; // Max number of images to fetch from Wikimedia Commons
// Country metadata (subset; extend as needed)
// Each entry: code -> { name, continent }
export const COUNTRY_METADATA = {
  US: { name: "United States", continent: "NA" },
  CA: { name: "Canada", continent: "NA" },
  MX: { name: "Mexico", continent: "NA" },
  GB: { name: "United Kingdom", continent: "EU" },
  IE: { name: "Ireland", continent: "EU" },
  FR: { name: "France", continent: "EU" },
  DE: { name: "Germany", continent: "EU" },
  ES: { name: "Spain", continent: "EU" },
  IT: { name: "Italy", continent: "EU" },
  NL: { name: "Netherlands", continent: "EU" },
  BE: { name: "Belgium", continent: "EU" },
  LU: { name: "Luxembourg", continent: "EU" },
  CH: { name: "Switzerland", continent: "EU" },
  AT: { name: "Austria", continent: "EU" },
  CZ: { name: "Czechia", continent: "EU" },
  PL: { name: "Poland", continent: "EU" },
  SE: { name: "Sweden", continent: "EU" },
  NO: { name: "Norway", continent: "EU" },
  FI: { name: "Finland", continent: "EU" },
  DK: { name: "Denmark", continent: "EU" },
  PT: { name: "Portugal", continent: "EU" },
  AU: { name: "Australia", continent: "OC" },
  NZ: { name: "New Zealand", continent: "OC" },
  BR: { name: "Brazil", continent: "SA" },
  AR: { name: "Argentina", continent: "SA" },
  CL: { name: "Chile", continent: "SA" },
  ZA: { name: "South Africa", continent: "AF" },
  IN: { name: "India", continent: "AS" },
  CN: { name: "China", continent: "AS" },
  JP: { name: "Japan", continent: "AS" },
  KR: { name: "South Korea", continent: "AS" },
};
// ====================

async function run() {
  // Prepare storage directory
  const storageDir = path.resolve("storage");
  await fs.mkdir(storageDir, { recursive: true });

  // Create / open DB
  const db = new Database(DB_FILE);
  db.pragma("journal_mode = wal");

  // Create table if needed
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
      id INTEGER PRIMARY KEY,
      title TEXT NOT NULL,
      wikidata_item TEXT,
      url TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      country_code TEXT,
      license TEXT,
      source TEXT NOT NULL,
      UNIQUE(url) ON CONFLICT IGNORE
    );
    CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_country ON ${TABLE_NAME}(country_code);
    CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_coords ON ${TABLE_NAME}(latitude, longitude);
    CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_wikidata ON ${TABLE_NAME}(wikidata_item);
    CREATE INDEX IF NOT EXISTS idx_${TABLE_NAME}_source ON ${TABLE_NAME}(source);
    CREATE TABLE IF NOT EXISTS country_codes (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      continent TEXT
    );
  `);

  // Populate country_codes (idempotent upsert)
  const insertCountry = db.prepare(
    `INSERT INTO country_codes(code, name, continent) VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET name=excluded.name, continent=excluded.continent`
  );
  const tx = db.transaction((entries) => {
    for (const [code, meta] of entries) {
      insertCountry.run(code, meta.name, meta.continent || null);
    }
  });
  tx(Object.entries(COUNTRY_METADATA));

  // Scrape Wikimedia Commons
  const commonsScraper = new WikimediaCommonsScraper(db, storageDir, {
    max: WIKIMEDIA_COMMONS_MAX,
  });
  await commonsScraper.scrape();

  // Scrape Wikidata SPARQL
  const parqlScraper = new WikimediaScraper(db, storageDir);
  await parqlScraper.scrape();

  const count = db.prepare(`SELECT COUNT(*) as n FROM ${TABLE_NAME}`).get().n;
  console.log(`Done. Table '${TABLE_NAME}' now has ${count} rows in '${DB_FILE}'.`);

  // After building DB, run storage cleanup (best-effort)
  try {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const cleanupPath = path.resolve(__dirname, "cleanup_storage.mjs");
    const { spawn } = await import("node:child_process");
    await new Promise((resolve) => {
      const p = spawn(process.execPath, [cleanupPath], { stdio: "inherit" });
      p.on("close", () => resolve());
    });
  } catch (e) {
    console.warn("Storage cleanup failed", e.message);
  }

  db.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

// --- Helpers ---
