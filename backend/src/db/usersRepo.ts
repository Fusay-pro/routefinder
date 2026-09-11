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
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string | null;
  google_id: string | null;
  display_name: string | null;
  role: UserRole;
  points_balance: number;
}

const SELECT_COLUMNS = 'id, email, password_hash, google_id, display_name, role, points_balance';

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    googleId: row.google_id,
    displayName: row.display_name,
    role: row.role,
    pointsBalance: row.points_balance,
  };
}

export async function createUserWithPassword(email: string, passwordHash: string, displayName: string | null): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING ${SELECT_COLUMNS}`,
    [email, passwordHash, displayName]
  );
  return toUser(rows[0]);
}

export async function createUserWithGoogle(email: string, googleId: string, displayName: string | null): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, google_id, display_name) VALUES ($1, $2, $3) RETURNING ${SELECT_COLUMNS}`,
    [email, googleId, displayName]
  );
  return toUser(rows[0]);
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
