import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';
import db from './index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, 'schema.sql');

const sql = fs.readFileSync(schemaPath, 'utf-8');
db.exec(sql);

console.log('Database migrated successfully.');
