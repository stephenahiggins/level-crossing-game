import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { OAuth2Client } from 'google-auth-library';
import db from '../db/index.mjs';
import { zValidator } from '../middleware/validator.mjs';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  displayName: z.string().min(2),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const googleSchema = z.object({
  idToken: z.string().min(10),
});

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const toUserPayload = (row) => ({
  id: row.id,
  email: row.email,
  displayName: row.display_name ?? row.displayName,
});

const signToken = (userId) =>
  jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '1h' });

router.post('/register', zValidator(registerSchema), async (req, res) => {
  const { email, password, displayName } = req.body;
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = await bcrypt.hash(password, 10);
  const stmt = db.prepare(
    'INSERT INTO users (email, password_hash, display_name, provider) VALUES (?, ?, ?, ?)',
  );
  const info = stmt.run(email.toLowerCase(), hash, displayName, 'local');
  const user = { id: info.lastInsertRowid, email: email.toLowerCase(), displayName };
  const token = signToken(user.id);
  res.status(201).json({ token, user });
});

router.post('/login', zValidator(loginSchema), async (req, res) => {
  const { email, password } = req.body;
  const stmt = db.prepare(
    'SELECT id, email, password_hash, display_name FROM users WHERE email = ?',
  );
  const row = stmt.get(email.toLowerCase());
  if (!row || !row.password_hash) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = signToken(row.id);
  res.json({ token, user: toUserPayload(row) });
});

router.post('/google/token', zValidator(googleSchema), async (req, res) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: req.body.idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) {
      return res.status(400).json({ error: 'Google token missing email' });
    }
    const email = payload.email.toLowerCase();
    const name = payload.name || email;
    let user = db
      .prepare('SELECT id, email, display_name FROM users WHERE email = ?')
      .get(email);
    if (!user) {
      const info = db
        .prepare(
          'INSERT INTO users (email, password_hash, display_name, provider) VALUES (?, NULL, ?, ?)',
        )
        .run(email, name, 'google');
      user = { id: info.lastInsertRowid, email, display_name: name };
    }
    const token = signToken(user.id);
    res.json({ token, user: toUserPayload(user) });
  } catch (error) {
    console.error('Google token error', error);
    res.status(400).json({ error: 'Invalid Google token' });
  }
});

export default router;
