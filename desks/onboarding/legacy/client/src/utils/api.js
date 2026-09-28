const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL || '')
  : ''; // dev: use Vite proxy → same origin

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function adminHeaders(staffId, pin, extra = {}) {
  return { 'X-Staff-Id': staffId, 'X-Admin-Pin': pin, ...extra };
}

export const api = {
  health: () => request('/api/health'),

  getHubContent: () => request('/api/hub/content'),

  signInStaff: (email) =>
    request('/api/staff/signin', { method: 'POST', body: JSON.stringify({ email }) }),

  registerStaff: (body) =>
    request('/api/staff/register', { method: 'POST', body: JSON.stringify(body) }),

  getStaff: (staffId) => request(`/api/staff/${staffId}`),

  getProgress: (staffId) => request(`/api/progress/${staffId}`),

  markRead: (staffId, itemId) =>
    request('/api/progress/read', { method: 'POST', body: JSON.stringify({ staffId, itemId }) }),

  markCheckpoint: (staffId, checkpointId) =>
    request('/api/progress/checkpoint', { method: 'POST', body: JSON.stringify({ staffId, checkpointId }) }),

  resetCheckpoint: (staffId, checkpointId, itemId) =>
    request('/api/progress/reset-checkpoint', {
      method: 'POST',
      body: JSON.stringify({ staffId, checkpointId, itemId }),
    }),

  verifyAdminPin: (staffId, pin) =>
    request('/api/admin/verify-pin', { method: 'POST', body: JSON.stringify({ staffId, pin }) }),

  adminOverview: (staffId, pin) =>
    request('/api/admin/overview', { headers: adminHeaders(staffId, pin) }),

  adminGetContent: (staffId, pin) =>
    request('/api/admin/content', { headers: adminHeaders(staffId, pin) }),

  adminAddItem: async (staffId, pin, formData) => {
    const res = await fetch(`${API_BASE}/api/admin/content/items`, {
      method: 'POST',
      headers: adminHeaders(staffId, pin),
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  adminUpdateItem: (staffId, pin, itemId, body) =>
    request(`/api/admin/content/items/${itemId}`, {
      method: 'PUT',
      headers: adminHeaders(staffId, pin),
      body: JSON.stringify(body),
    }),

  adminRemoveItem: (staffId, pin, itemId) =>
    request(`/api/admin/content/items/${itemId}`, {
      method: 'DELETE',
      headers: adminHeaders(staffId, pin),
    }),
};
