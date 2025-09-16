import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Router } from 'express';

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataPath = path.resolve(__dirname, '../data/level_crossings.json');

let cached = { data: [], mtimeMs: 0 };
let missingLogged = false;

const loadCrossings = () => {
  try {
    const stats = fs.statSync(dataPath);
    if (stats.mtimeMs !== cached.mtimeMs) {
      const raw = fs.readFileSync(dataPath, 'utf-8');
      const parsed = JSON.parse(raw);
      cached = {
        data: Array.isArray(parsed) ? parsed : [],
        mtimeMs: stats.mtimeMs,
      };
    }
    missingLogged = false;
  } catch (error) {
    if (error.code === 'ENOENT') {
      if (!missingLogged) {
        console.warn(`Level crossings metadata not found at ${dataPath}`);
        missingLogged = true;
      }
    } else {
      console.error('Failed to read level crossings metadata', error);
    }
    cached = { data: [], mtimeMs: 0 };
  }
  return cached.data;
};

router.get('/', (req, res) => {
  const data = loadCrossings();
  res.json(data);
});

export default router;
