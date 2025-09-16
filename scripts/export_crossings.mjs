#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (key && key.startsWith('--')) {
    args.set(key.slice(2), value);
  }
}

const dbPath = args.get('db') ? path.resolve(process.cwd(), args.get('db')) : path.resolve(root, 'level_crossings.sqlite');
const imageRoot = args.get('images') ? path.resolve(process.cwd(), args.get('images')) : path.resolve(root, 'scraper/storage');
const outputJson = path.resolve(root, 'frontend/src/assets/level_crossings.json');
const outputImages = path.resolve(root, 'frontend/public/crossings');

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);
const rows = db.prepare('SELECT id, image_path, country_code FROM level_crossings').all();

fs.mkdirSync(outputImages, { recursive: true });

const exportRows = [];
for (const row of rows) {
  const relative = row.image_path?.replace(/^\/+/, '') ?? '';
  const fileName = path.basename(relative);
  const source = path.resolve(imageRoot, relative);
  const dest = path.resolve(outputImages, fileName);
  if (!fs.existsSync(source)) {
    console.warn(`Missing image for crossing ${row.id}: ${source}`);
    continue;
  }
  fs.copyFileSync(source, dest);
  exportRows.push({
    id: row.id,
    image_path: `/crossings/${fileName}`,
    country_code: row.country_code,
  });
}

fs.writeFileSync(outputJson, `${JSON.stringify(exportRows, null, 2)}\n`);
console.log(`Exported ${exportRows.length} crossings to ${outputJson}`);
