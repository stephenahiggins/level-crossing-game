import jwt from 'jsonwebtoken';
import db from '../db/index.mjs';

export const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  const [, token] = header.split(' ');
  if (!token) {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const stmt = db.prepare('SELECT id, email, display_name as displayName FROM users WHERE id = ?');
    const user = stmt.get(payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
