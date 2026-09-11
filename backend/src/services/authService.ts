import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { createUser, findUserByEmail, type User } from '../db/usersRepo.js';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), { expiresIn: TOKEN_EXPIRY });
}

export function toPublicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    pointsBalance: user.pointsBalance,
  };
}

export async function signup(email: string, password: string, displayName: string | null) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new Error('Email already registered');
  }
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await createUser(email, passwordHash, displayName);
  return { user: toPublicUser(user), token: signToken(user.id) };
}

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new Error('Invalid email or password');
  }
  return { user: toPublicUser(user), token: signToken(user.id) };
}

export function verifyToken(token: string): string {
  const decoded = jwt.verify(token, getJwtSecret()) as { sub: string };
  return decoded.sub;
}
