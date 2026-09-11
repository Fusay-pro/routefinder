import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService.js';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.header('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  if (!token) {
    res.status(401).json({ error: 'Missing bearer token' });
    return;
  }
  try {
    res.locals.userId = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
