import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { refreshTokens } from '../db/schema.js';
import { eq, and, gt } from 'drizzle-orm';
import crypto from 'crypto';

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET must be set and at least 32 characters');
  }
  return secret;
}

// ============================================================
// Password hashing
// ============================================================

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ============================================================
// Token generation
// ============================================================

export interface TokenPayload {
  userId: string;
  email: string;
}

export function generateAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: ACCESS_TOKEN_EXPIRY });
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export function verifyAccessToken(token: string): TokenPayload {
  return jwt.verify(token, getSecret()) as TokenPayload;
}

// ============================================================
// Refresh token persistence (hashed in DB for security)
// ============================================================

export async function saveRefreshToken(userId: string, token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(
    Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  db.insert(refreshTokens).values({ userId, tokenHash, expiresAt }).run();
}

export async function validateRefreshToken(
  userId: string,
  token: string
): Promise<boolean> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const now = new Date().toISOString();

  const result = db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.userId, userId),
        eq(refreshTokens.tokenHash, tokenHash),
        gt(refreshTokens.expiresAt, now)
      )
    )
    .get();

  return !!result;
}

export async function revokeRefreshToken(userId: string, token: string): Promise<void> {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.delete(refreshTokens)
    .where(
      and(eq(refreshTokens.userId, userId), eq(refreshTokens.tokenHash, tokenHash))
    )
    .run();
}

export async function revokeAllUserTokens(userId: string): Promise<void> {
  db.delete(refreshTokens).where(eq(refreshTokens.userId, userId)).run();
}

// Clean expired tokens (called by cron)
export function cleanExpiredTokens(): void {
  const now = new Date().toISOString();
  db.delete(refreshTokens).where(gt(now, refreshTokens.expiresAt)).run();
}
