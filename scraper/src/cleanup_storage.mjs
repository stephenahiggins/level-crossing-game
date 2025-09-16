// cleanup_storage.mjs
// Removes files in storage/ not referenced in the level_crossings.url column.
// Usage: node ./src/cleanup_storage.mjs

import Database from "better-sqlite3";
import { promises as fs } from "fs";
import path from "path";

const DB_FILE = "level_crossings.sqlite";
const TABLE = "level_crossings";

async function main() {
  const storageDir = path.resolve("storage");
  const db = new Database(DB_FILE, { readonly: true });
  const rows = db.prepare(`SELECT url FROM ${TABLE}`).all();
  const referenced = new Set(rows.map((r) => path.basename(r.url)));
  const files = await fs.readdir(storageDir);
  let removed = 0;
  for (const f of files) {
    if (!referenced.has(f)) {
      await fs.unlink(path.join(storageDir, f)).catch(() => {});
      removed++;
    }
  }
  console.log(`Cleanup complete. Removed ${removed} unreferenced files out of ${files.length}.`);
  db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
