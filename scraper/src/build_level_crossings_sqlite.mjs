// build_level_crossings_sqlite.mjs
// Node 18+ (has global fetch). Creates/updates a SQLite DB with level crossings.

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";
import WikimediaCommonsScraper from "./scrapers/wikimedia_commons.js";
import WikimediaScraper from "./scrapers/wikimedia_parql.js";

// ====== CONFIG ======
const DB_FILE = "level_crossings.sqlite";
const TABLE_NAME = "level_crossings";
const WIKIMEDIA_COMMONS_MAX = 20000; // Max number of images to fetch from Wikimedia Commons
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
  `);

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
  db.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

// --- Helpers ---
