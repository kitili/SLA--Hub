'use client';

export function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isNetworkError(err) {
  if (isBrowserOffline()) return true;
  if (!err) return false;
  if (err.response) return false;
  const code = err.code || '';
  return (
    code === 'ERR_NETWORK' ||
    code === 'ECONNABORTED' ||
    code === 'ERR_CANCELED' ||
    err.message === 'Network Error'
  );
}

export function isOfflineFailure(err) {
  if (isNetworkError(err)) return true;
  const status = err?.response?.status;
  return status === 408 || status === 502 || status === 503 || status === 504;
}

export function readStoredAuthToken() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('sla-auth');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    return token || null;
  } catch {
    return null;
  }
}

export function clearStoredAuthSession() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem('sla-auth');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    parsed.state = { ...(parsed.state || {}), user: null, token: null, mustChangePassword: false };
    localStorage.setItem('sla-auth', JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
  localStorage.removeItem('silverleaf-auth');
}
