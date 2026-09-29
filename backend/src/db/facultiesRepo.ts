import { pool } from './pool.js';

export interface Faculty {
  id: string;
  name: string;
  slug: string;
}

export type FacultyChangeStatus = 'pending' | 'approved' | 'rejected';

export interface FacultyChangeRequest {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  currentFacultyName: string | null;
  requestedFacultyId: string;
  requestedFacultyName: string;
  note: string | null;
  status: FacultyChangeStatus;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listFaculties(): Promise<Faculty[]> {
  const { rows } = await pool.query<Faculty>('SELECT id, name, slug FROM faculties ORDER BY name');
  return rows;
}

export async function findFacultyById(id: string): Promise<Faculty | null> {
  const { rows } = await pool.query<Faculty>('SELECT id, name, slug FROM faculties WHERE id = $1', [id]);
  return rows[0] ?? null;
}

const REQUEST_SELECT = `SELECT r.id, r.user_id, u.email AS user_email, u.display_name AS user_display_name,
         cf.name AS current_faculty_name, r.requested_faculty_id, rf.name AS requested_faculty_name,
         r.note, r.status, r.created_at, r.resolved_at
    FROM faculty_change_requests r
    JOIN users u ON u.id = r.user_id
    JOIN faculties rf ON rf.id = r.requested_faculty_id
    LEFT JOIN faculties cf ON cf.id = u.faculty_id`;

interface RequestRow {
  id: string;
  user_id: string;
  user_email: string;
  user_display_name: string | null;
  current_faculty_name: string | null;
  requested_faculty_id: string;
  requested_faculty_name: string;
  note: string | null;
  status: FacultyChangeStatus;
  created_at: string;
  resolved_at: string | null;
}

function toRequest(row: RequestRow): FacultyChangeRequest {
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    userDisplayName: row.user_display_name,
    currentFacultyName: row.current_faculty_name,
    requestedFacultyId: row.requested_faculty_id,
    requestedFacultyName: row.requested_faculty_name,
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export type CreateRequestError = 'already_pending' | 'already_in_faculty';

// The partial unique index on (user_id) WHERE status = 'pending' is what
// actually enforces one open request at a time; this just turns the constraint
// violation into an error the route can map to a status code.
export async function createFacultyChangeRequest(
  userId: string,
  requestedFacultyId: string,
  note: string | null
): Promise<FacultyChangeRequest> {
  const current = await pool.query<{ faculty_id: string | null }>('SELECT faculty_id FROM users WHERE id = $1', [userId]);
  if (current.rows[0]?.faculty_id === requestedFacultyId) {
    throw new Error('already_in_faculty' satisfies CreateRequestError);
  }

  try {
    const { rows } = await pool.query<{ id: string }>(
      `INSERT INTO faculty_change_requests (user_id, requested_faculty_id, note) VALUES ($1, $2, $3) RETURNING id`,
      [userId, requestedFacultyId, note]
    );
    const created = await pool.query<RequestRow>(`${REQUEST_SELECT} WHERE r.id = $1`, [rows[0].id]);
    return toRequest(created.rows[0]);
  } catch (err) {
    if (err instanceof Error && 'code' in err && (err as { code?: string }).code === '23505') {
      throw new Error('already_pending' satisfies CreateRequestError);
    }
    throw err;
  }
}

export async function listFacultyChangeRequests(status: FacultyChangeStatus): Promise<FacultyChangeRequest[]> {
  const { rows } = await pool.query<RequestRow>(
    `${REQUEST_SELECT} WHERE r.status = $1 ORDER BY r.created_at`,
    [status]
  );
  return rows.map(toRequest);
}

export async function findPendingRequestForUser(userId: string): Promise<FacultyChangeRequest | null> {
  const { rows } = await pool.query<RequestRow>(
    `${REQUEST_SELECT} WHERE r.user_id = $1 AND r.status = 'pending'`,
    [userId]
  );
  return rows[0] ? toRequest(rows[0]) : null;
}

// Resolving and moving the user happen together: an approval that didn't move
// the user, or a move without an audit row saying who approved it, would both
// be worse than failing. The status guard makes a double-approval a no-op
// rather than a second move.
export async function resolveFacultyChangeRequest(
  requestId: string,
  adminId: string,
  decision: 'approved' | 'rejected'
): Promise<FacultyChangeRequest | null> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query<{ user_id: string; requested_faculty_id: string }>(
      `UPDATE faculty_change_requests SET status = $1, resolved_by = $2, resolved_at = now()
        WHERE id = $3 AND status = 'pending'
        RETURNING user_id, requested_faculty_id`,
      [decision, adminId, requestId]
    );

    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    if (decision === 'approved') {
      await client.query('UPDATE users SET faculty_id = $1, updated_at = now() WHERE id = $2', [
        rows[0].requested_faculty_id,
        rows[0].user_id,
      ]);
    }

    const resolved = await client.query<RequestRow>(`${REQUEST_SELECT} WHERE r.id = $1`, [requestId]);
    await client.query('COMMIT');
    return toRequest(resolved.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
