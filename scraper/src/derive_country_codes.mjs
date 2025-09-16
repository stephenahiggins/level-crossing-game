// derive_country_codes.mjs
// Populate missing country_code values in level_crossings table using reverse geocoding.
// Uses Nominatim (OpenStreetMap) public endpoint with polite rate limiting.
// Usage: node ./src/derive_country_codes.mjs
// ENV: NOMINATIM_EMAIL optional to set email in User-Agent per usage policy.

import Database from "better-sqlite3";

const DB_FILE = "level_crossings.sqlite";
const TABLE = "level_crossings";
const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const BATCH_SIZE = 50; // DB fetch batch
const SLEEP_MS = 1100; // ~1 req/sec

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function reverseGeocode(lat, lon) {
  const email = process.env.NOMINATIM_EMAIL || "example@example.com";
  const url = `${NOMINATIM_URL}?format=jsonv2&lat=${encodeURIComponent(
    lat
  )}&lon=${encodeURIComponent(lon)}&zoom=3&addressdetails=1`;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": `level-crossings/1.0 (${email})` } });
      if (res.status === 429) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const code = data?.address?.country_code; // lowercase ISO2
      if (code && /^[a-z]{2}$/.test(code)) return code.toUpperCase();
      return null;
    } catch (e) {
      if (attempt === 2) {
        console.warn("reverseGeocode failed", lat, lon, e.message);
        return null;
      }
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

async function main() {
  const db = new Database(DB_FILE);
  const selectStmt = db.prepare(
    `SELECT id, latitude, longitude FROM ${TABLE} WHERE country_code IS NULL LIMIT ?`
  );
  const updateStmt = db.prepare(`UPDATE ${TABLE} SET country_code = ? WHERE id = ?`);

  let totalUpdated = 0;
  while (true) {
    const rows = selectStmt.all(BATCH_SIZE);
    if (!rows.length) break;
    for (const r of rows) {
      const code = await reverseGeocode(r.latitude, r.longitude);
      if (code) {
        updateStmt.run(code, r.id);
        totalUpdated++;
        process.stdout.write(`\rUpdated ${totalUpdated} (last ${code})   `);
      }
      await sleep(SLEEP_MS); // rate limit
    }
  }
  console.log(`\nCountry code derivation complete. Total updated: ${totalUpdated}`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
