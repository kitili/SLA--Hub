'use client';

const VAULT_KEY = 'sla-offline-login';
const MAX_ACCOUNTS = 8;
const ITERATIONS = 80000;

export class OfflineLoginError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'OfflineLoginError';
    this.code = code;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function readVault() {
  if (typeof window === 'undefined') return { accounts: {} };
  try {
    const parsed = JSON.parse(localStorage.getItem(VAULT_KEY) || '{}');
    return parsed && typeof parsed.accounts === 'object' ? parsed : { accounts: {} };
  } catch {
    return { accounts: {} };
  }
}

function writeVault(vault) {
  localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const clean = String(hex || '');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function hexEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function deriveVerifier(password, saltHex, iterations = ITERATIONS) {
  if (!globalThis.crypto?.subtle) {
    throw new OfflineLoginError('UNSUPPORTED', 'This browser cannot store an offline sign-in.');
  }
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(saltHex), iterations },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

function pruneAccounts(accounts) {
  const rows = Object.values(accounts).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return Object.fromEntries(rows.slice(0, MAX_ACCOUNTS).map((row) => [row.email, row]));
}

function portalAllows(user, portal) {
  const roles = [user?.role, ...(user?.additionalRoles || [])].filter(Boolean);
  if (portal === 'ceo') return roles.includes('ceo');
  return roles.some((role) => (
    role === 'ceo'
    || role === 'global_marketing_head'
    || role === 'campus_marketing_head'
    || role === 'global_student_exp_head'
    || role === 'campus_student_exp_head'
    || role === 'nurse'
  ));
}

export function lastOfflineLoginEmail() {
  const rows = Object.values(readVault().accounts || {});
  if (!rows.length) return '';
  rows.sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
  return rows[0].email || '';
}

export function hasOfflineLogin(email) {
  const key = normalizeEmail(email);
  if (key) return Boolean(readVault().accounts?.[key]);
  return Object.keys(readVault().accounts || {}).length > 0;
}

export async function rememberOfflineLogin({ email, password, portal, user, token }) {
  if (typeof window === 'undefined' || !user || !password) return;
  if (!globalThis.crypto?.subtle) return;
  const key = normalizeEmail(email || user.email);
  if (!key) return;
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const verifier = await deriveVerifier(password, salt);
  const vault = readVault();
  vault.accounts[key] = {
    email: key,
    salt,
    verifier,
    iterations: ITERATIONS,
    portal: portal || 'staff',
    token: token || null,
    user,
    savedAt: Date.now(),
  };
  vault.accounts = pruneAccounts(vault.accounts);
  writeVault(vault);
}

export async function unlockOfflineLogin(email, password, portal) {
  const key = normalizeEmail(email);
  const row = readVault().accounts?.[key];
  if (!row?.verifier || !row?.user) {
    throw new OfflineLoginError(
      'NO_CACHED_ACCOUNT',
      'Sign in once while online on this phone. After that you can sign in without signal.'
    );
  }
  if (!portalAllows(row.user, portal)) {
    throw new OfflineLoginError('BAD_PASSWORD', 'Email or password is incorrect.');
  }
  const next = await deriveVerifier(password, row.salt, row.iterations || ITERATIONS);
  if (!hexEqual(next, row.verifier)) {
    throw new OfflineLoginError('BAD_PASSWORD', 'Email or password is incorrect.');
  }
  return {
    user: row.user,
    token: row.token || null,
    mustChangePassword: false,
    offline: true,
  };
}
