import { pool } from './pool.js';

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  googleId: string | null;
  displayName: string | null;
  role: UserRole;
  pointsBalance: number;
  facultyId: string | null;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  display_name: string | null;
  role: UserRole;
  points_balance: number;
  faculty_id: string | null;
}

const SELECT_COLUMNS = 'id, email, password_hash, google_id, display_name, role, points_balance, faculty_id';

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    googleId: row.google_id,
    displayName: row.display_name,
    role: row.role,
    pointsBalance: row.points_balance,
    facultyId: row.faculty_id,
  };
}

export async function createUserWithPassword(
  email: string,
  passwordHash: string,
  displayName: string,
  facultyId: string
): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, display_name, faculty_id) VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_COLUMNS}`,
    [email, passwordHash, displayName, facultyId]
  );
  return toUser(rows[0]);
}

// Google sign-in gives us a name but never a faculty, so a Google-created
// account starts without one and is prompted to pick before it can appear on a
// faculty board. See routes/faculties.ts.
export async function createUserWithGoogle(email: string, googleId: string, displayName: string | null): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, google_id, display_name) VALUES ($1, $2, $3) RETURNING ${SELECT_COLUMNS}`,
    [email, googleId, displayName]
  );
  return toUser(rows[0]);
}

// Only ever called for a user who has no faculty yet — changing an existing one
// goes through the admin-approved request flow in db/facultiesRepo.ts.
export async function setInitialFaculty(userId: string, facultyId: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET faculty_id = $1, updated_at = now()
      WHERE id = $2 AND faculty_id IS NULL RETURNING ${SELECT_COLUMNS}`,
    [facultyId, userId]
  );
  return rows[0] ? toUser(rows[0]) : null;
}

export async function linkGoogleId(userId: string, googleId: string): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `UPDATE users SET google_id = $1, updated_at = now() WHERE id = $2 RETURNING ${SELECT_COLUMNS}`,
    [googleId, userId]
  );
  return toUser(rows[0]);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`, [email]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserByGoogleId(googleId: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE google_id = $1`, [googleId]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}
