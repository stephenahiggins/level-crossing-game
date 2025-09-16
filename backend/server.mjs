import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './db/index.mjs';
import authRouter from './routes/auth.mjs';
import scoresRouter from './routes/scores.mjs';
import crossingsRouter from './routes/crossings.mjs';
import { authMiddleware } from './middleware/auth.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, 'db/schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf-8');
db.exec(schema);

const app = express();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173'];

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/scores', scoresRouter);
app.use('/api/crossings', crossingsRouter);
app.get('/api/me', authMiddleware, (req, res) => {
  res.json(req.user);
});

const crossingsDir = path.resolve(__dirname, 'public/crossings');
if (fs.existsSync(crossingsDir)) {
  app.use('/crossings', express.static(crossingsDir));
} else {
  console.warn(`Crossings image directory not found at ${crossingsDir}. Run the export script to populate assets.`);
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
