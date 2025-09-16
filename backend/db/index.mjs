import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.resolve(__dirname, 'level_crossings.db');
const dbPath = process.env.DATABASE_PATH ? path.resolve(process.cwd(), process.env.DATABASE_PATH) : defaultPath;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

typeof process.env.NODE_ENV !== 'production' && console.log(`[db] Using database at ${dbPath}`);

export default db;
