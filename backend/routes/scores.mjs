import { Router } from 'express';
import { z } from 'zod';
import db from '../db/index.mjs';
import { authMiddleware } from '../middleware/auth.mjs';
import { zValidator } from '../middleware/validator.mjs';

const router = Router();

const modeEnum = z.enum(['easy', 'medium', 'hard']);

const scoreSchema = z.object({
  mode: modeEnum,
  score: z.number().int().min(0),
  duration: z.number().int().min(0),
  correctCount: z.number().int().min(0),
  avgTimePerCorrect: z.number().min(0),
});

const topQuerySchema = z.object({
  mode: modeEnum,
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

router.post('/', authMiddleware, zValidator(scoreSchema), (req, res) => {
  const { mode, score, duration, correctCount, avgTimePerCorrect } = req.body;
  const stmt = db.prepare(
    `INSERT INTO scores(user_id, mode, score, duration_seconds, correct_count, avg_time_per_correct, created_at)
     VALUES (?, ?, ?, ?, ?, ?, strftime('%s','now'))`,
  );
  stmt.run(req.user.id, mode, score, duration, correctCount, avgTimePerCorrect);
  res.status(201).json({ ok: true });
});

router.get('/top', zValidator(topQuerySchema, 'query'), (req, res) => {
  const { mode, limit } = req.query;
  const stmt = db.prepare(
    `SELECT s.id, u.display_name as displayName, s.score, s.mode, s.duration_seconds as duration, s.correct_count as correctCount,
            s.avg_time_per_correct as avgTimePerCorrect, s.created_at as createdAt
     FROM scores s
     JOIN users u ON u.id = s.user_id
     WHERE s.mode = ?
     ORDER BY s.score DESC, s.avg_time_per_correct ASC, s.created_at ASC
     LIMIT ?`,
  );
  const rows = stmt.all(mode, limit).map((row) => ({
    ...row,
    createdAt: new Date(row.createdAt * 1000).toISOString(),
  }));
  res.json(rows);
});

export default router;
