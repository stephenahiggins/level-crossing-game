import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import db from './index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const seedPath = path.resolve(__dirname, 'seed.sql');

const sql = fs.readFileSync(seedPath, 'utf-8');
db.exec(sql);

console.log('Database seeded successfully.');
