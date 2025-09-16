#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const parseArgs = () => {
  const parsed = new Map();
  for (let i = 2; i < process.argv.length; i += 1) {
    const token = process.argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = process.argv[i + 1];
    if (!next || next.startsWith("--")) {
      parsed.set(key, "true");
    } else {
      parsed.set(key, next);
      i += 1;
    }
  }
  return parsed;
};

const args = parseArgs();

const resolvePath = (value, fallback) => (value ? path.resolve(process.cwd(), value) : fallback);

const defaultDbPath = path.resolve(root, "scraper/level_crossings.sqlite");
const dbPath = resolvePath(args.get("db"), defaultDbPath);
console.log("Using database:", dbPath);
const defaultImageRoot = path.resolve(root, "scraper/storage");
const imageRoot = resolvePath(args.get("images"), defaultImageRoot);

const parseTargets = (value) =>
  value
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

const requestedTargets = new Set(
  parseTargets(args.get("targets") ?? args.get("target") ?? "backend")
);

if (args.get("backend") === "true") {
  requestedTargets.add("backend");
}
if (args.get("frontend") === "true") {
  requestedTargets.add("frontend");
}

if (!requestedTargets.size) {
  requestedTargets.add("backend");
}

const targetConfigs = [];

if (requestedTargets.has("backend")) {
  targetConfigs.push({
    name: "backend",
    json: path.resolve(root, "backend/data/level_crossings.json"),
    images: path.resolve(root, "backend/public/crossings"),
  });
}

if (requestedTargets.has("frontend")) {
  targetConfigs.push({
    name: "frontend",
    json: path.resolve(root, "frontend/src/assets/level_crossings.json"),
    images: path.resolve(root, "frontend/public/crossings"),
  });
}

if (!targetConfigs.length) {
  console.error(
    "No valid export targets supplied. Use --target backend, --target frontend, or --target backend,frontend"
  );
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found at ${dbPath}`);
  process.exit(1);
}

if (!fs.existsSync(imageRoot)) {
  console.error(`Image storage directory not found at ${imageRoot}`);
  process.exit(1);
}

const ensureDir = (dirPath) => {
  fs.mkdirSync(dirPath, { recursive: true });
};

for (const target of targetConfigs) {
  ensureDir(path.dirname(target.json));
  ensureDir(target.images);
}

const sanitizeRelativePath = (relativePath) => {
  const normalized = path
    .normalize(relativePath)
    .replace(/^([.][.][/\\])+/, "")
    .replace(/^storage[/\\]/i, "")
    .replace(/^[/\\]+/, "");
  if (!normalized) return "";
  return normalized
    .split(/[\\/]+/)
    .filter(Boolean)
    .join("/");
};

const db = new Database(dbPath, { readonly: true });
const rows = db.prepare("SELECT id, url, country_code FROM level_crossings").all();

const exportMap = new Map();

for (const row of rows) {
  const id = Number(row.id);
  if (!Number.isFinite(id)) {
    console.warn(`Skipping row with invalid id: ${row.id}`);
    continue;
  }

  const countryCode = String(row.country_code ?? row.countryCode ?? "").toUpperCase();
  const rawImagePath = String(row.url ?? row.url ?? "");
  const relativePath = sanitizeRelativePath(rawImagePath);

  if (!relativePath) {
    console.warn(`Skipping crossing ${id} due to missing image path`);
    continue;
  }

  if (!countryCode) {
    console.warn(`Skipping crossing ${id} due to missing country code`);
    continue;
  }

  const candidatePaths = [relativePath, rawImagePath];
  let sourcePath = null;
  let exportRelative = null;

  for (const candidate of candidatePaths) {
    const cleanCandidate = sanitizeRelativePath(candidate);
    if (!cleanCandidate) continue;
    const possibleSource = path.resolve(imageRoot, cleanCandidate);
    if (fs.existsSync(possibleSource) && fs.statSync(possibleSource).isFile()) {
      sourcePath = possibleSource;
      exportRelative = cleanCandidate;
      break;
    }
  }

  if (!sourcePath || !exportRelative) {
    console.warn(`Missing image file for crossing ${id}: ${rawImagePath}`);
    continue;
  }

  for (const target of targetConfigs) {
    const destination = path.resolve(target.images, exportRelative);
    ensureDir(path.dirname(destination));
    fs.copyFileSync(sourcePath, destination);
  }

  exportMap.set(id, {
    id,
    url: `/crossings/${exportRelative}`,
    country_code: countryCode,
  });
}

const exportRows = Array.from(exportMap.values()).sort((a, b) => a.id - b.id);

for (const target of targetConfigs) {
  fs.writeFileSync(target.json, `${JSON.stringify(exportRows, null, 2)}\n`);
  console.log(`Wrote ${exportRows.length} crossings metadata to ${target.json}`);
}

console.log(
  `Copied assets for ${exportRows.length} crossings into: ${targetConfigs
    .map((target) => target.images)
    .join(", ")}`
);

db.close();
