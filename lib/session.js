import crypto from 'node:crypto';
import { parse, serialize } from 'cookie';

const COOKIE = 'uplanner_session';

function secret() {
  return process.env.SESSION_SECRET || 'CHANGE_ME_IN_VERCEL';
}

function sign(value) {
  return crypto.createHmac('sha256', secret()).update(value).digest('base64url');
}

export function setSession(res, userId, username) {
  const payload = Buffer.from(JSON.stringify({ userId, username }), 'utf8').toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  res.setHeader('Set-Cookie', serialize(COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30
  }));
}

export function clearSession(res) {
  res.setHeader('Set-Cookie', serialize(COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0
  }));
}

export function getSession(req) {
  const cookies = parse(req.headers.cookie || '');
  const token = cookies[COOKIE];
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
