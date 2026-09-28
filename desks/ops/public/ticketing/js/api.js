/**
 * API facade — online Supabase + offline cache/outbox.
 */

import { isOnline } from "./connectivity.js";
import * as remote from "./api-remote.js";
import * as store from "./offline-store.js";
import { syncNow, refreshPinCache } from "./sync.js";

export const DEPARTMENTS = remote.DEPARTMENTS;
export const CATEGORIES = remote.CATEGORIES;
export const PRIORITIES = remote.PRIORITIES;
export const CAMPUSES = remote.CAMPUSES;
export const getOrCreateOwnerToken = remote.getOrCreateOwnerToken;

export const isConfigured = remote.isConfigured;
export const hashPin = remote.hashPin;

function formatDisplay(iso) {
  return remote.formatDisplay(iso);
}

function shouldUseNetwork() {
  return isOnline() && isConfigured();
}

function applyOutboxToRequest(req, outbox) {
  let r = { ...req };
  const id = r.id;
  for (const item of outbox) {
    const rid = item.requestId || item.localId;
    if (rid !== id && (item.localId !== id)) continue;
    if (item.type === "patch_status") {
      r = { ...r, status: item.payload.status, updated_at: item.createdAt, _pending: true };
    }
    if (item.type === "mark_received") {
      r = { ...r, status: "closed", _pending: true };
    }
    if (item.type === "reopen") {
      r = { ...r, status: "open", _pending: true };
    }
  }
  return r;
}

async function mergeRequestList(params, remoteList) {
  const outbox = await store.getOutbox();
  const localCreates = outbox
    .filter((o) => o.type === "create_request")
    .map((o) => {
      const now = o.createdAt;
      const p = o.payload;
      return remote.mapRequest({
        id: o.localId,
        display_id: p.display_id || null,
        owner_token: p.owner_token || null,
        department: p.department,
        requester_name: p.requester_name,
        campus: p.campus || "",
        title: p.title,
        details: p.details,
        category: p.category || "General",
        priority: p.priority || "normal",
        urgency: p.priority === "urgent" ? "urgent" : "normal",
        status: "open",
        created_at: now,
        updated_at: now,
        _pending: true,
        _offline: true,
      });
    });

  let rows = [...remoteList, ...localCreates];
  if (!shouldUseNetwork()) {
    const cached = await store.getAllRequests();
    rows = cached.length ? cached : rows;
  }

  const seen = new Set();
  const merged = [];
  for (const r of rows) {
    const applied = applyOutboxToRequest(r, outbox);
    if (seen.has(applied.id)) continue;
    seen.add(applied.id);
    if (params.department && applied.department !== params.department) continue;
    if (params.status && applied.status !== params.status) continue;
    if (params.requester_name) {
      const want = String(params.requester_name).trim().toLowerCase();
      const got = String(applied.requester_name || "").trim().toLowerCase();
      if (got !== want) continue;
    }
    if (params.owner_token) {
      // Legacy rows without token still match by requester_name filter above
      if (applied.owner_token && applied.owner_token !== params.owner_token) continue;
    }
    merged.push(applied);
  }

  const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
  const order = { open: 0, in_progress: 1, pending_info: 2, resolved: 3, closed: 4, declined: 5 };
  merged.sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? PRIORITY_RANK[a.urgency] ?? 2;
    const pb = PRIORITY_RANK[b.priority] ?? PRIORITY_RANK[b.urgency] ?? 2;
    if (pa !== pb) return pa - pb;
    const sa = order[a.status] ?? 9;
    const sb = order[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  return { requests: merged };
}

export async function login(body) {
  const { role, pin } = body || {};

  if (role === "manager") {
    if (shouldUseNetwork()) {
      const result = await remote.loginRemote(body);
      await refreshPinCache();
      return result;
    }
    const { salt, hash } = await store.getCachedPinSettings();
    if (!salt || !hash) {
      throw new Error("Offline: manager login needs one online sign-in first to cache PIN.");
    }
    const h = await hashPin(String(pin || ""), salt);
    if (h !== hash) throw new Error("Invalid manager PIN.");
    return { ok: true, user: { role: "manager", name: "Operations Manager", department: null } };
  }

  if (role === "requester") {
    if (shouldUseNetwork()) return remote.loginRemote(body);
    const { department } = body || {};
    const homeDept =
      department && DEPARTMENTS.includes(department) ? department : null;
    return { ok: true, user: { role: "requester", name: null, department: homeDept } };
  }

  throw new Error("Invalid role.");
}

export async function getManagerPinStatus() {
  if (shouldUseNetwork()) {
    const s = await remote.getManagerPinStatusRemote();
    await refreshPinCache();
    return s;
  }
  const { hash } = await store.getCachedPinSettings();
  return { configured: Boolean(hash) };
}

export async function changeManagerPin(old_pin, new_pin) {
  if (!shouldUseNetwork()) {
    throw new Error("Change PIN requires an internet connection.");
  }
  const res = await remote.changeManagerPinRemote(old_pin, new_pin);
  await refreshPinCache();
  return res;
}

export async function getDepartments() {
  return { departments: DEPARTMENTS };
}

export async function getTicketMeta() {
  return { categories: CATEGORIES, priorities: PRIORITIES };
}

export async function getStats() {
  if (shouldUseNetwork()) {
    try {
      const s = await remote.getStatsRemote();
      return s;
    } catch {
      /* fall through to cache */
    }
  }
  const { requests } = await mergeRequestList({}, []);
  const newCount = requests.filter((r) => r.status === "open").length;
  const openCount = requests.filter((r) => !["closed", "declined"].includes(r.status)).length;
  return { newCount, openCount };
}

export async function listRequests(params = {}) {
  if (shouldUseNetwork()) {
    try {
      const { requests } = await remote.listRequestsRemote(params);
      await store.cacheRequests(requests);
      return mergeRequestList(params, requests);
    } catch (err) {
      if (!navigator.onLine) {
        return mergeRequestList(params, []);
      }
      throw err;
    }
  }
  return mergeRequestList(params, []);
}

export async function getRequest(id) {
  const resolvedId = await store.resolveId(id);

  if (shouldUseNetwork()) {
    try {
      const data = await remote.getRequestRemote(resolvedId);
      await store.putRequest(data.request);
      await store.cacheMessagesForRequest(resolvedId, data.messages);
      return data;
    } catch (err) {
      if (!navigator.onLine) {
        return getRequestFromCache(id);
      }
      throw err;
    }
  }
  return getRequestFromCache(id);
}

async function getRequestFromCache(id) {
  const resolvedId = await store.resolveId(id);
  let request = await store.getRequest(resolvedId);
  if (!request && id !== resolvedId) request = await store.getRequest(id);
  if (!request) throw new Error("Not found (offline — open this ticket once while online).");

  const outbox = await store.getOutbox();
  request = applyOutboxToRequest(remote.mapRequest(request), outbox);

  let messages = await store.getMessagesForRequest(resolvedId);
  if (!messages.length && id !== resolvedId) {
    messages = await store.getMessagesForRequest(id);
  }
  messages = messages.map((m) => ({
    ...m,
    created_at_display: m.created_at_display || formatDisplay(m.created_at),
  }));

  for (const item of outbox) {
    if (item.type !== "post_message") continue;
    const rid = item.requestId || item.localId;
    if (rid !== id && rid !== resolvedId) continue;
    messages.push({
      author_role: item.payload.author_role,
      author_name: item.payload.author_name,
      body: item.payload.body,
      created_at: item.createdAt,
      created_at_display: formatDisplay(item.createdAt),
      _local: true,
    });
  }
  messages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return { request, messages };
}

export async function submitRequest(body) {
  const owner_token = body.owner_token || remote.getOrCreateOwnerToken();
  const payload = { ...body, owner_token };

  if (shouldUseNetwork()) {
    try {
      const res = await remote.submitRequestRemote(payload);
      await store.putRequest({ ...res.row, _pending: false });
      syncNow().catch(() => {});
      return { id: res.id, status: res.status, created_at: res.created_at, row: res.row };
    } catch (err) {
      if (navigator.onLine) throw err;
    }
  }

  const localId = store.generateLocalRequestId();
  const now = new Date().toISOString();
  const row = remote.mapRequest({
    id: localId,
    display_id: null,
    owner_token,
    department: body.department,
    requester_name: body.requester_name.trim(),
    campus: (body.campus || "").trim(),
    title: body.title.trim(),
    details: body.details.trim(),
    category: body.category || "General",
    priority: body.priority || "normal",
    urgency: body.priority === "urgent" ? "urgent" : "normal",
    status: "open",
    created_at: now,
    updated_at: now,
    _pending: true,
    _offline: true,
  });

  await store.putRequest(row);
  await store.addLocalMessage(localId, {
    author_role: "requester",
    author_name: row.requester_name,
    body: "Ticket opened (offline — will sync).",
    created_at: now,
    created_at_display: formatDisplay(now),
  });
  await store.addOutbox({
    type: "create_request",
    localId,
    requestId: localId,
    payload,
  });

  return { id: localId, status: "open", created_at: now, _queued: true, row };
}

export async function assignTicket(id, body) {
  const resolvedId = await store.resolveId(id);

  if (shouldUseNetwork()) {
    try {
      const res = await remote.assignTicketRemote(resolvedId, body);
      syncNow().catch(() => {});
      return res;
    } catch (err) {
      if (navigator.onLine) throw err;
    }
  }

  const req = (await store.getRequest(resolvedId)) || (await store.getRequest(id));
  if (!req) throw new Error("Not found.");
  const t = new Date().toISOString();
  const assigned_to = String(body.assigned_to || "").trim();
  const status = req.status === "open" ? "in_progress" : req.status;
  await store.putRequest({
    ...req,
    assigned_to,
    status,
    updated_at: t,
    _pending: true,
  });
  await store.addOutbox({ type: "assign", requestId: resolvedId, payload: body });
  return { ok: true, assigned_to, status, _queued: true };
}

export async function patchStatus(id, body) {
  const resolvedId = await store.resolveId(id);

  if (shouldUseNetwork()) {
    try {
      const res = await remote.patchStatusRemote(resolvedId, body);
      syncNow().catch(() => {});
      return res;
    } catch (err) {
      if (navigator.onLine) throw err;
    }
  }

  const req = await store.getRequest(resolvedId) || (await store.getRequest(id));
  if (!req) throw new Error("Not found.");
  const t = new Date().toISOString();
  const updated = { ...req, status: body.status, updated_at: t, _pending: true };
  await store.putRequest(updated);
  await store.addOutbox({ type: "patch_status", requestId: resolvedId, payload: body });
  return { ok: true, status: body.status, _queued: true };
}

export async function markReceived(id, body) {
  const resolvedId = await store.resolveId(id);

  if (shouldUseNetwork()) {
    try {
      const res = await remote.markReceivedRemote(resolvedId, body);
      syncNow().catch(() => {});
      return res;
    } catch (err) {
      if (navigator.onLine) throw err;
    }
  }

  const req = (await store.getRequest(resolvedId)) || (await store.getRequest(id));
  if (req) {
    const t = new Date().toISOString();
    await store.putRequest({
      ...req,
      status: "closed",
      closed_at: t,
      updated_at: t,
      _pending: true,
    });
  }
  await store.addOutbox({ type: "mark_received", requestId: resolvedId, payload: body });
  return { ok: true, status: "closed", _queued: true };
}

export async function reopenTicket(id, body) {
  const resolvedId = await store.resolveId(id);

  if (shouldUseNetwork()) {
    try {
      const res = await remote.reopenTicketRemote(resolvedId, body);
      syncNow().catch(() => {});
      return res;
    } catch (err) {
      if (navigator.onLine) throw err;
    }
  }

  const req = (await store.getRequest(resolvedId)) || (await store.getRequest(id));
  if (req) {
    await store.putRequest({ ...req, status: "open", updated_at: new Date().toISOString(), _pending: true });
  }
  await store.addOutbox({ type: "reopen", requestId: resolvedId, payload: body });
  return { ok: true, status: "open", _queued: true };
}

export async function postMessage(id, body) {
  const resolvedId = await store.resolveId(id);
  const t = new Date().toISOString();

  if (shouldUseNetwork()) {
    try {
      const res = await remote.postMessageRemote(resolvedId, body);
      syncNow().catch(() => {});
      return res;
    } catch (err) {
      if (navigator.onLine) throw err;
    }
  }

  await store.addLocalMessage(resolvedId, {
    author_role: body.author_role,
    author_name: body.author_name,
    body: body.body,
    created_at: t,
    created_at_display: formatDisplay(t),
  });
  await store.addOutbox({ type: "post_message", requestId: resolvedId, payload: body });
  return { ok: true, created_at: t, _queued: true };
}

export async function exportForGoogleSheets(from, to) {
  if (!shouldUseNetwork()) {
    throw new Error("Export requires an internet connection.");
  }
  return remote.exportForGoogleSheetsRemote(from, to);
}

export async function downloadCsv(from, to) {
  if (!shouldUseNetwork()) {
    throw new Error("CSV export requires an internet connection.");
  }
  return remote.downloadCsvRemote(from, to);
}

export { syncNow, refreshPinCache };
