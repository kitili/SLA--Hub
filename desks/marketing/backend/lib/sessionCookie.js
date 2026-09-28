/**
 * Cookie sessions — same shape as Silverleaf Onboarding Hub.
 *
 * HMAC-SHA256 payload { userId, iat, exp }. 15-minute sliding idle window.
 * Cookie name is mse-specific so it does not overwrite the hub's
 * __sla_session on 127.0.0.1 (cookies are not port-scoped).
 *
 * Local http:  __sla_mse_session
 * Production:  __Host-sla_mse_session (Secure + Path=/ + no Domain)
 */

const crypto = require('crypto');

const SESSION_TTL_MS = 15 * 60 * 1000;
const SESSION_SLIDE_AFTER_MS = 60 * 1000;
const DEV_FALLBACK_SECRET = 'dev-secret-change-me-in-production';

function isSecureSessionCookie() {
  return process.env.NODE_ENV === 'production';
}

function getSessionCookieName() {
  return isSecureSessionCookie() ? '__Host-sla_mse_session' : '__sla_mse_session';
}

function resolveSecret() {
  const secret = process.env.SESSION_SECRET || process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET or JWT_SECRET is required for cookie sessions.');
  }
  return DEV_FALLBACK_SECRET;
}

function sessionCookieFlags() {
  const parts = ['HttpOnly', 'SameSite=Lax', 'Path=/'];
  if (isSecureSessionCookie()) parts.push('Secure');
  return parts;
}

function serializeCookie(value, maxAgeSec) {
  return [
    `${getSessionCookieName()}=${value}`,
    `Max-Age=${maxAgeSec}`,
    ...sessionCookieFlags(),
  ].join('; ');
}

function buildSessionPayload(userId, now = Date.now()) {
  return {
    userId: Number(userId),
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
}

function encodeSession(payload) {
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', resolveSecret()).update(json).digest('base64url');
  return `${json}.${sig}`;
}

function decodeSession(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const dot = raw.lastIndexOf('.');
  if (dot === -1) return null;
  const json = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = crypto.createHmac('sha256', resolveSecret()).update(json).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(json, 'base64url').toString('utf8'));
    if (typeof parsed.userId !== 'number' || typeof parsed.exp !== 'number') return null;
    if (Date.now() > parsed.exp) return null;
    return {
      userId: parsed.userId,
      iat: typeof parsed.iat === 'number' ? parsed.iat : 0,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

function shouldSlideSession(session, now = Date.now()) {
  return now - session.iat >= SESSION_SLIDE_AFTER_MS;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i === -1) continue;
    const key = part.slice(0, i).trim();
    const val = part.slice(i + 1).trim();
    try {
      out[key] = decodeURIComponent(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function readSession(req) {
  const raw = parseCookies(req.headers.cookie)[getSessionCookieName()];
  return decodeSession(raw);
}

function setSessionCookie(res, userId) {
  const value = encodeSession(buildSessionPayload(userId));
  appendSetCookie(res, serializeCookie(value, SESSION_TTL_MS / 1000));
}

function clearSessionCookie(res) {
  appendSetCookie(res, serializeCookie('', 0));
}

function appendSetCookie(res, line) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', line);
    return;
  }
  res.setHeader('Set-Cookie', Array.isArray(prev) ? [...prev, line] : [prev, line]);
}

function slideSessionIfNeeded(req, res, session) {
  if (!session || !shouldSlideSession(session)) return;
  setSessionCookie(res, session.userId);
}

module.exports = {
  SESSION_TTL_MS,
  SESSION_SLIDE_AFTER_MS,
  getSessionCookieName,
  isSecureSessionCookie,
  buildSessionPayload,
  encodeSession,
  decodeSession,
  shouldSlideSession,
  parseCookies,
  readSession,
  setSessionCookie,
  clearSessionCookie,
  slideSessionIfNeeded,
};
