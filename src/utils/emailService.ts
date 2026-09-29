import crypto from 'crypto';
const jwt = require("jsonwebtoken");
import { JwtProps } from '../models/User';
import { Request, Response, NextFunction } from 'express';

export type TokenType = 'access' | 'refresh';
export type Role = 'user' | 'admin';

const getSecret = (): string => {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET is not set in .env');
  return s;
};

const b64u = (v: Buffer | string) => Buffer.from(v).toString('base64url');
const hmac = (data: string) => crypto.createHmac('sha256', getSecret()).update(data).digest();

export const generateSecureToken = (): { token: string; expires: Date } => {
  const token = crypto.randomBytes(64).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { token, expires };
};

export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
  const verificationUrl = `http://localhost:3000/api/auth/verify-email?token=${token}`;
  console.log(`[email service] Отправка письма на ${email}`);
  console.log(`[email service] Ссылка для подтверждения: ${verificationUrl}`);
};

export function signToken(
  input: { sub: string; type: TokenType; roles: Role[]; isEmailVerified: boolean },
  ttlSec: number
): { token: string; payload: JwtProps } {
  const iat = Math.floor(Date.now() / 1000);
  const payload: JwtProps = {
    ...input,
    iat,
    exp: iat + ttlSec,
    jti: crypto.randomUUID(),
  };
  const header = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64u(JSON.stringify(payload));
  const sig = b64u(hmac(`${header}.${body}`));
  return { token: `${header}.${body}.${sig}`, payload };
}

export function verifyToken(token: string, expectedType: TokenType): JwtProps {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [h, b, s] = parts;

  const header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
  if (header.alg !== 'HS256') throw new Error('Unsupported alg');

  const expected = hmac(`${h}.${b}`);
  const actual = Buffer.from(s, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    throw new Error('Bad signature');
  }

  const payload = JSON.parse(Buffer.from(b, 'base64url').toString('utf8')) as JwtProps;
  if (typeof payload.exp !== 'number' || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  if (payload.type !== expectedType) throw new Error('Wrong token type');
  if (!payload.sub || !payload.jti) throw new Error('Missing claims');
  return payload;
}

