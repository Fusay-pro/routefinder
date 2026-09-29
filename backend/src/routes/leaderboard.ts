import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  individualBoard,
  facultyBoard,
  myStanding,
  type BoardActivity,
  type BoardFilters,
  type BoardMetric,
  type BoardWindow,
  type FacultyRankBy,
} from '../db/leaderboardRepo.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const METRICS: BoardMetric[] = ['distance', 'co2'];
const ACTIVITIES: BoardActivity[] = ['foot', 'cycle', 'walk', 'run', 'bike'];
const WINDOWS: BoardWindow[] = ['week', 'month', 'all'];

export const leaderboardRouter = Router();

function pick<T extends string>(raw: unknown, allowed: T[], fallback: T): T {
  return typeof raw === 'string' && (allowed as string[]).includes(raw) ? (raw as T) : fallback;
}

function parseFilters(query: Record<string, unknown>): BoardFilters {
  return {
    metric: pick(query.metric, METRICS, 'distance'),
    activity: pick(query.activity, ACTIVITIES, 'foot'),
    window: pick(query.window, WINDOWS, 'week'),
  };
}

function parseLimit(raw: unknown): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

// Signed-in only. The boards carry students' display names next to their
// faculty and how much they move each week; that's a roster we shouldn't hand
// to anyone who finds the URL, even though nothing here is a secret.
leaderboardRouter.get('/leaderboard', requireAuth, async (req, res) => {
  const filters = parseFilters(req.query as Record<string, unknown>);
  const limit = parseLimit(req.query.limit);
  const scope = pick(req.query.scope, ['individual', 'faculty'] as const, 'individual');

  try {
    if (scope === 'faculty') {
      const rankBy = pick(req.query.rankBy, ['per_member', 'total'] as const, 'per_member') as FacultyRankBy;
      res.json({ scope, ...filters, rankBy, rows: await facultyBoard(filters, rankBy, limit) });
      return;
    }
    res.json({ scope, ...filters, rows: await individualBoard(filters, limit) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load leaderboard' });
  }
});

// The caller's own standing under the same filters, so the UI can show
// "42nd of 380" without paging through the whole board to find them.
leaderboardRouter.get('/leaderboard/me', requireAuth, async (req, res) => {
  const filters = parseFilters(req.query as Record<string, unknown>);
  try {
    res.json({ ...filters, ...(await myStanding(res.locals.userId as string, filters)) });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load standing' });
  }
});
