import type { Request, Response, NextFunction } from 'express';
import { findUserById } from '../db/usersRepo.js';

// Must run after requireAuth — depends on res.locals.userId already being set.
export async function requireAdmin(_req: Request, res: Response, next: NextFunction) {
  try {
    const user = await findUserById(res.locals.userId as string);
    if (!user || user.role !== 'admin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to verify admin access' });
  }
}
