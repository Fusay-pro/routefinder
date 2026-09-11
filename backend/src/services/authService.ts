import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import {
  createUserWithPassword,
  createUserWithGoogle,
  findUserByEmail,
  findUserByGoogleId,
  linkGoogleId,
  type User,
} from '../db/usersRepo.js';

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
  const user = await createUserWithPassword(email, passwordHash, displayName);
  return { user: toPublicUser(user), token: signToken(user.id) };
}

export async function login(email: string, password: string) {
  const user = await findUserByEmail(email);
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    throw new Error('Invalid email or password');
  }
  return { user: toPublicUser(user), token: signToken(user.id) };
}

// TODO(later): once you implement Google Sign-In on the client, it hands you
// an ID token — pass that straight through to this function. GOOGLE_CLIENT_ID
// must match the OAuth client ID configured on the Google Cloud side, since
// verifyIdToken checks the token's audience against it.
export async function loginWithGoogle(idToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID is not configured');

  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const payload = ticket.getPayload();
  if (!payload?.sub || !payload.email) {
    throw new Error('Google token did not include the expected profile fields');
  }
  const { sub: googleId, email, email_verified: emailVerified, name } = payload;

  let user = await findUserByGoogleId(googleId);
  if (!user) {
    const existingByEmail = await findUserByEmail(email);
    if (existingByEmail) {
      // Only trust the token's email for linking to an existing account if
      // Google itself verified it — an unverified email claim shouldn't be
      // enough to attach a new sign-in method to someone else's account.
      if (!emailVerified) {
        throw new Error('Google account email is not verified; sign in with password instead');
      }
      user = await linkGoogleId(existingByEmail.id, googleId);
    } else {
      user = await createUserWithGoogle(email, googleId, name ?? null);
    }
  }

  return { user: toPublicUser(user), token: signToken(user.id) };
}

export function verifyToken(token: string): string {
  const decoded = jwt.verify(token, getJwtSecret()) as { sub: string };
  return decoded.sub;
}
