import { pool } from './pool.js';

export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  role: UserRole;
  pointsBalance: number;
}

interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  role: UserRole;
  points_balance: number;
}

const SELECT_COLUMNS = 'id, email, password_hash, display_name, role, points_balance';

function toUser(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    role: row.role,
    pointsBalance: row.points_balance,
  };
}

export async function createUser(email: string, passwordHash: string, displayName: string | null): Promise<User> {
  const { rows } = await pool.query<UserRow>(
    `INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING ${SELECT_COLUMNS}`,
    [email, passwordHash, displayName]
  );
  return toUser(rows[0]);
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE email = $1`, [email]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query<UserRow>(`SELECT ${SELECT_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}
