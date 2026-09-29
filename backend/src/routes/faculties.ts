import { Router } from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireAdmin } from '../middleware/requireAdmin.js';
import {
  listFaculties,
  findFacultyById,
  createFacultyChangeRequest,
  listFacultyChangeRequests,
  findPendingRequestForUser,
  resolveFacultyChangeRequest,
  type FacultyChangeStatus,
} from '../db/facultiesRepo.js';
import { setInitialFaculty } from '../db/usersRepo.js';
import { toPublicUser } from '../services/authService.js';

export const facultiesRouter = Router();

const REQUEST_STATUSES: FacultyChangeStatus[] = ['pending', 'approved', 'rejected'];

// Public: the signup form needs the list before anyone has an account.
facultiesRouter.get('/faculties', async (_req, res) => {
  try {
    res.json(await listFaculties());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list faculties' });
  }
});

// For accounts created through Google Sign-In, which never carries a faculty.
// Only fills an empty slot — changing an existing one is the request flow below.
facultiesRouter.post('/faculties/me', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const { facultyId } = req.body ?? {};

  if (typeof facultyId !== 'string' || !(await findFacultyById(facultyId))) {
    res.status(400).json({ error: 'facultyId is required and must be one of GET /faculties' });
    return;
  }

  try {
    const updated = await setInitialFaculty(userId, facultyId);
    if (!updated) {
      res.status(409).json({ error: 'You already have a faculty — request a change instead' });
      return;
    }
    res.json(toPublicUser(updated));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to set faculty' });
  }
});

// Moving faculty is a request, not a setting. The faculty board is a contest
// between groups, so letting people reassign themselves would let them pile
// onto whichever one is winning.
facultiesRouter.post('/faculty-change-requests', requireAuth, async (req, res) => {
  const userId = res.locals.userId as string;
  const { facultyId, note } = req.body ?? {};

  if (typeof facultyId !== 'string' || !(await findFacultyById(facultyId))) {
    res.status(400).json({ error: 'facultyId is required and must be one of GET /faculties' });
    return;
  }

  try {
    const created = await createFacultyChangeRequest(
      userId,
      facultyId,
      typeof note === 'string' && note.trim() ? note.trim() : null
    );
    res.status(201).json(created);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to request a faculty change';
    if (message === 'already_pending') {
      res.status(409).json({ error: 'You already have a pending faculty change request' });
      return;
    }
    if (message === 'already_in_faculty') {
      res.status(409).json({ error: 'You are already in that faculty' });
      return;
    }
    res.status(500).json({ error: message });
  }
});

// The caller's own open request, so the profile screen can show it as pending.
facultiesRouter.get('/faculty-change-requests/me', requireAuth, async (_req, res) => {
  try {
    res.json(await findPendingRequestForUser(res.locals.userId as string));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to load request' });
  }
});

facultiesRouter.get('/faculty-change-requests', requireAuth, requireAdmin, async (req, res) => {
  const status = REQUEST_STATUSES.includes(req.query.status as FacultyChangeStatus)
    ? (req.query.status as FacultyChangeStatus)
    : 'pending';
  try {
    res.json(await listFacultyChangeRequests(status));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to list requests' });
  }
});

facultiesRouter.patch('/faculty-change-requests/:id', requireAuth, requireAdmin, async (req, res) => {
  const { decision } = req.body ?? {};
  if (decision !== 'approved' && decision !== 'rejected') {
    res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
    return;
  }

  try {
    const resolved = await resolveFacultyChangeRequest(req.params.id, res.locals.userId as string, decision);
    if (!resolved) {
      res.status(404).json({ error: 'No pending request with that id' });
      return;
    }
    res.json(resolved);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to resolve request' });
  }
});
