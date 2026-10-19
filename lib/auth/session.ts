import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { prisma } from '../prisma';

export const SESSION_DURATION_SECONDS = 12 * 60 * 60; // 12 hours = 43,200 seconds
export const COOKIE_NAME = 'auth_token';

const JWT_SECRET = process.env.JWT_SECRET || 'tangence-audit-tool-enterprise-jwt-auth-secret-key-32-chars';
const SECRET_KEY = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  userId: string;
  email: string;
  name?: string | null;
  sessionId?: string;
  exp?: number;
  iat?: number;
}

/**
 * Hash a plain password using bcrypt with salt rounds 10
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a plain password against the stored bcrypt hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Sign a JWT token that strictly expires after 12 hours
 */
export async function signToken(payload: {
  userId: string;
  email: string;
  name?: string | null;
  sessionId?: string;
}): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(SECRET_KEY);
}

/**
 * Verify a JWT token. Returns null if invalid or expired (e.g. after 12 hours)
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Retrieve the current authenticated user from cookies, or null if not logged in / expired
 */
export async function getCurrentUser() {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifyToken(token);
    if (!payload?.userId) return null;

    // Check if session exists in DB and is not expired
    if (payload.sessionId) {
      const session = await prisma.session.findUnique({
        where: { id: payload.sessionId }
      });
      if (!session || new Date() > session.expiresAt) {
        return null;
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true
      }
    });

    return user;
  } catch {
    return null;
  }
}
