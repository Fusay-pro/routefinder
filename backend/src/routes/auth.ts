import { Router } from 'express';
import { signup, login, toPublicUser } from '../services/authService.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { findUserById } from '../db/usersRepo.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

authRouter.post('/auth/signup', async (req, res) => {
  const { email, password, displayName } = req.body ?? {};

  if (typeof email !== 'string' || !EMAIL_RE.test(email) || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    res.status(400).json({ error: `A valid email and a password of at least ${MIN_PASSWORD_LENGTH} characters are required` });
    return;
  }

  try {
    const result = await signup(email, password, typeof displayName === 'string' ? displayName : null);
    res.status(201).json(result);
  } catch (err) {
    res.status(409).json({ error: err instanceof Error ? err.message : 'Signup failed' });
  }
});

authRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};

  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ error: 'email and password are required' });
    return;
  }

  try {
    const result = await login(email, password);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed' });
  }
});

authRouter.get('/auth/me', requireAuth, async (_req, res) => {
  const user = await findUserById(res.locals.userId as string);
  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json(toPublicUser(user));
});
