/**
 * Direct Supabase API (used when online and by sync).
 */

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";
import { SUPABASE_URL as CFG_URL, SUPABASE_ANON_KEY as CFG_KEY } from "./config.js";

export const DEPARTMENTS = ["Transport", "Facilities", "Kitchen", "Security", "Farms"];
export const CATEGORIES = ["General", "Supplies", "Maintenance", "Transport", "Security", "Farming", "Other"];
export const PRIORITIES = ["low", "normal", "high", "urgent"];
export const CAMPUSES = [
  "Usariver Campus",
  "Arusha Modern Campus",
  "Kijenge Campus",
  "Ilboru Campus",
  "Boma Campus",
];

const OWNER_TOKEN_KEY = "ops_desk_owner_token";

export function getOrCreateOwnerToken() {
  try {
    let t = localStorage.getItem(OWNER_TOKEN_KEY);
    if (t && /^[0-9a-f-]{36}$/i.test(t)) return t;
    t = globalThis.crypto?.randomUUID?.() || fallbackUuid();
    localStorage.setItem(OWNER_TOKEN_KEY, t);
    return t;
  } catch {
    return fallbackUuid();
  }
}

function fallbackUuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let _client = null;

/** Project URL only — not .../rest/v1/ (common copy mistake). */
function normalizeSupabaseUrl(raw) {
  let url = (raw || "").trim();
  if (!url) return "";
  url = url.replace(/\/rest\/v1\/?$/i, "").replace(/\/+$/, "");
  if (!url.startsWith("http")) url = "https://" + url;
  return url;
}

function supabaseConfig() {
  const w = globalThis.__SL_ENV__;
  return {
    url: normalizeSupabaseUrl(w?.SUPABASE_URL || CFG_URL),
    key: (w?.SUPABASE_ANON_KEY || CFG_KEY || "").trim(),
  };
}

export function isConfigured() {
  const { url, key } = supabaseConfig();
  return Boolean(
    url &&
      key &&
      !url.includes("YOUR_PROJECT") &&
      !key.includes("YOUR_ANON")
  );
}

function assertConfigured() {
  if (!isConfigured()) {
    throw new Error(
      "Supabase not linked. Set SUPABASE_URL + SUPABASE_ANON_KEY, then redeploy or edit config.js for local dev."
    );
  }
}

export function getSupabase() {
  assertConfigured();
  const { url, key } = supabaseConfig();
  if (!_client) _client = createClient(url, key);
  return _client;
}

export function formatDisplay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}

export function mapRequest(row) {
  if (!row) return row;
  return {
    ...row,
    created_at_display: formatDisplay(row.created_at),
    updated_at_display: formatDisplay(row.updated_at),
    resolved_at_display: formatDisplay(row.resolved_at),
    closed_at_display: formatDisplay(row.closed_at),
  };
}

export function mapMessage(m) {
  return { ...m, created_at_display: formatDisplay(m.created_at) };
}

export async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 120000,
      hash: "SHA-256",
    },
    keyMaterial,
    256
  );
  const bytes = new Uint8Array(bits);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getSetting(key) {
  const { data, error } = await getSupabase().from("settings").select("value").eq("key", key).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.value ?? null;
}

async function setSetting(key, value) {
  const { error } = await getSupabase().from("settings").upsert({ key, value }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

export async function fetchPinSettings() {
  const stored = await getSetting("manager_pin_hash");
  const salt = await getSetting("pin_salt");
  return { stored, salt };
}

export async function loginRemote(body) {
  const { role, department, pin } = body || {};
  if (role === "manager") {
    const { stored, salt } = await fetchPinSettings();
    if (!stored || !salt) throw new Error("Manager PIN not configured in Supabase.");
    const h = await hashPin(String(pin || ""), salt);
    if (h !== stored) throw new Error("Invalid manager PIN.");
    return { ok: true, user: { role: "manager", name: "Operations Manager", department: null } };
  }
  if (role === "requester") {
    const homeDept =
      department && DEPARTMENTS.includes(department) ? department : null;
    return { ok: true, user: { role: "requester", name: null, department: homeDept } };
  }
  throw new Error("Invalid role.");
}

export async function getManagerPinStatusRemote() {
  const stored = await getSetting("manager_pin_hash");
  return { configured: Boolean(stored && !stored.includes("PLACEHOLDER")) };
}

export async function changeManagerPinRemote(old_pin, new_pin) {
  if (!new_pin || String(new_pin).length < 4) throw new Error("New PIN too short.");
  const salt = await getSetting("pin_salt");
  const stored = await getSetting("manager_pin_hash");
  if (!salt || !stored) throw new Error("PIN not configured.");
  const oldHash = await hashPin(String(old_pin), salt);
  if (oldHash !== stored) throw new Error("Old PIN is incorrect.");
  await setSetting("manager_pin_hash", await hashPin(String(new_pin), salt));
  return { ok: true };
}

export async function getStatsRemote() {
  const { data, error } = await getSupabase().from("requests").select("status");
  if (error) throw new Error(error.message);
  const rows = data || [];
  const newCount = rows.filter((r) => r.status === "open").length;
  const openCount = rows.filter((r) => !["closed", "declined"].includes(r.status)).length;
  return { newCount, openCount };
}

export async function listRequestsRemote(params = {}) {
  let q = getSupabase().from("requests").select("*");
  if (params.department) q = q.eq("department", params.department);
  if (params.status) q = q.eq("status", params.status);
  if (params.requester_name) {
    q = q.ilike("requester_name", String(params.requester_name).trim());
  }
  const { data, error } = await q.order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const PRIORITY_RANK = { urgent: 0, high: 1, normal: 2, low: 3 };
  const order = { open: 0, in_progress: 1, pending_info: 2, resolved: 3, closed: 4, declined: 5 };
  let rows = data || [];
  if (params.requester_name) {
    const want = String(params.requester_name).trim().toLowerCase();
    rows = rows.filter(
      (r) => String(r.requester_name || "").trim().toLowerCase() === want
    );
  }
  if (params.owner_token) {
    // Prefer token match; keep legacy rows (no token) that already matched name
    rows = rows.filter(
      (r) => !r.owner_token || r.owner_token === params.owner_token
    );
  }
  const sorted = rows.sort((a, b) => {
    const pa = PRIORITY_RANK[a.priority] ?? PRIORITY_RANK[a.urgency] ?? 2;
    const pb = PRIORITY_RANK[b.priority] ?? PRIORITY_RANK[b.urgency] ?? 2;
    if (pa !== pb) return pa - pb;
    const sa = order[a.status] ?? 9;
    const sb = order[b.status] ?? 9;
    if (sa !== sb) return sa - sb;
    return new Date(b.created_at) - new Date(a.created_at);
  });
  return { requests: sorted.map(mapRequest) };
}

export async function getRequestRemote(id) {
  const { data: request, error: e1 } = await getSupabase().from("requests").select("*").eq("id", id).maybeSingle();
  if (e1) throw new Error(e1.message);
  if (!request) throw new Error("Not found.");
  const { data: messages, error: e2 } = await getSupabase()
    .from("messages")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: true });
  if (e2) throw new Error(e2.message);
  return { request: mapRequest(request), messages: (messages || []).map(mapMessage) };
}

export async function nextRequestId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return fallbackUuid();
}

async function nextDisplayId() {
  try {
    const { data, error } = await getSupabase().rpc("desk_next_display_id");
    if (!error && data) return String(data);
  } catch {
    /* column/RPC may not exist yet */
  }
  // Fallback: TKT- + time-based suffix
  const n = Date.now() % 10000;
  return "TKT-" + String(n).padStart(4, "0");
}

export async function submitRequestRemote(body, options = {}) {
  const {
    department,
    requester_name,
    campus,
    title,
    details,
    category,
    priority,
    owner_token,
    owner_uid,
    source_type,
    source_id,
    source_url,
  } = body || {};
  if (!department || !requester_name || !title || !details) {
    throw new Error("Missing required fields.");
  }
  if (!DEPARTMENTS.includes(department)) throw new Error("Invalid department.");

  const id = options.id || (await nextRequestId());
  const display_id = options.display_id || (await nextDisplayId());
  const now = new Date().toISOString();
  const normalizedPriority = PRIORITIES.includes(priority) ? priority : "normal";
  const token = owner_token || getOrCreateOwnerToken();
  const row = {
    id,
    display_id,
    owner_token: token,
    owner_uid: owner_uid || null,
    department,
    requester_name: requester_name.trim(),
    campus: (campus || "").trim(),
    title: title.trim(),
    details: details.trim(),
    urgency: normalizedPriority === "urgent" ? "urgent" : "normal",
    category: (category || "General").trim(),
    priority: normalizedPriority,
    status: "open",
    created_at: now,
    updated_at: now,
    source_type: source_type ? String(source_type).trim() : null,
    source_id: source_id ? String(source_id).trim() : null,
    source_url: source_url ? String(source_url).trim() : null,
  };

  let { error: e1 } = await getSupabase().from("requests").insert(row);
  // Fallback if an older DB is missing optional columns
  if (
    e1 &&
    /display_id|owner_token|owner_uid|priority|updated_at|source_type|source_id|source_url|PGRST204/i.test(
      e1.message || "",
    )
  ) {
    const lean = {
      id,
      department: row.department,
      requester_name: row.requester_name,
      campus: row.campus,
      title: row.title,
      details: row.details,
      urgency: row.urgency,
      category: row.category,
      status: row.status,
      created_at: now,
    };
    if (!/priority|PGRST204/i.test(e1.message || "")) {
      lean.priority = row.priority;
      lean.updated_at = now;
    }
    ({ error: e1 } = await getSupabase().from("requests").insert(lean));
    if (!e1) {
      row.display_id = null;
      row.owner_token = null;
    }
  }
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await getSupabase().from("messages").insert({
    request_id: id,
    author_role: "requester",
    author_name: row.requester_name,
    body: "Ticket opened.",
    created_at: now,
  });
  if (e2) throw new Error(e2.message);

  return { id, status: "open", created_at: now, row: mapRequest(row) };
}

export async function assignTicketRemote(id, body) {
  const { assigned_to, actor_name, note } = body || {};
  const name = String(assigned_to || "").trim();
  if (!name) throw new Error("Assignee name required.");

  const { data: row, error: e0 } = await getSupabase().from("requests").select("*").eq("id", id).maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!row) throw new Error("Not found.");

  const t = new Date().toISOString();
  const patch = {
    assigned_to: name,
    updated_at: t,
    status: row.status === "open" ? "in_progress" : row.status,
  };
  if (!row.first_seen_at) patch.first_seen_at = t;

  const { error } = await getSupabase().from("requests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);

  const actor = (actor_name || "Operations Manager").trim();
  await getSupabase().from("messages").insert({
    request_id: id,
    author_role: "manager",
    author_name: actor,
    body: note?.trim()
      ? "Assigned to " + name + ": " + note.trim()
      : "Assigned to " + name + ".",
    created_at: t,
  });

  return { ok: true, assigned_to: name, status: patch.status };
}

export async function patchStatusRemote(id, body) {
  const { status, actor_name } = body || {};
  const allowed = ["open", "in_progress", "pending_info", "resolved", "closed", "declined"];
  if (!allowed.includes(status)) throw new Error("Invalid status.");

  const { data: row, error: e0 } = await getSupabase().from("requests").select("*").eq("id", id).maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!row) throw new Error("Not found.");

  const t = new Date().toISOString();
  const name = (actor_name || "Operations Manager").trim();
  const patch = { status, updated_at: t };

  if (!row.first_seen_at) patch.first_seen_at = t;
  if (status === "resolved") {
    patch.resolved_at = t;
    patch.resolved_by = name;
  }
  if (status === "closed") {
    patch.closed_at = t;
    patch.closed_by = name;
  }
  if (status === "declined") {
    patch.declined_at = t;
    patch.declined_by = name;
  }

  const { error } = await getSupabase().from("requests").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true, status };
}

export async function markReceivedRemote(id, body) {
  const { requester_name, note } = body || {};
  const { data: row, error: e0 } = await getSupabase().from("requests").select("*").eq("id", id).maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!row) throw new Error("Not found.");
  if (row.status !== "resolved") throw new Error("Ticket must be Resolved before you can Close it.");

  const t = new Date().toISOString();
  const name = (requester_name || row.requester_name).trim();
  const { error: e1 } = await getSupabase()
    .from("requests")
    .update({ status: "closed", closed_at: t, closed_by: name, updated_at: t })
    .eq("id", id);
  if (e1) throw new Error(e1.message);

  await getSupabase().from("messages").insert({
    request_id: id,
    author_role: "requester",
    author_name: name,
    body: note?.trim() ? "Closed: " + note.trim() : "Closed by requester.",
    created_at: t,
  });
  return { ok: true, status: "closed" };
}

export async function reopenTicketRemote(id, body) {
  const { requester_name, note } = body || {};
  const { data: row, error: e0 } = await getSupabase().from("requests").select("*").eq("id", id).maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!row) throw new Error("Not found.");
  if (!["resolved", "closed"].includes(row.status)) {
    throw new Error("Only resolved/closed tickets can be reopened.");
  }

  const t = new Date().toISOString();
  const name = (requester_name || row.requester_name).trim();
  const { error } = await getSupabase().from("requests").update({ status: "open", updated_at: t }).eq("id", id);
  if (error) throw new Error(error.message);

  await getSupabase().from("messages").insert({
    request_id: id,
    author_role: "requester",
    author_name: name,
    body: note?.trim() ? "Reopened: " + note.trim() : "Ticket reopened.",
    created_at: t,
  });
  return { ok: true, status: "open" };
}

export async function postMessageRemote(id, body) {
  const { author_role, author_name, body: text } = body || {};
  if (!text?.trim()) throw new Error("Message required.");

  const { data: row, error: e0 } = await getSupabase()
    .from("requests")
    .select("status, first_seen_at")
    .eq("id", id)
    .maybeSingle();
  if (e0) throw new Error(e0.message);
  if (!row) throw new Error("Not found.");

  const t = new Date().toISOString();
  const { error: e1 } = await getSupabase().from("messages").insert({
    request_id: id,
    author_role: author_role === "manager" ? "manager" : "requester",
    author_name: (author_name || "User").trim(),
    body: text.trim(),
    created_at: t,
  });
  if (e1) throw new Error(e1.message);

  if (author_role === "manager" && row.status === "open") {
    await getSupabase()
      .from("requests")
      .update({
        status: "in_progress",
        first_seen_at: row.first_seen_at || t,
        updated_at: t,
      })
      .eq("id", id);
  }
  return { ok: true, created_at: t };
}

const EXPORT_HEADERS = [
  "id",
  "department",
  "requester_name",
  "campus",
  "title",
  "category",
  "priority",
  "assigned_to",
  "status",
  "created_at",
  "resolved_at",
  "closed_at",
  "details",
];

export async function fetchExportRows(from, to) {
  let q = getSupabase().from("requests").select("*").order("created_at", { ascending: true });
  if (from) q = q.gte("created_at", from);
  if (to) q = q.lte("created_at", to + "T23:59:59.999Z");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return { headers: EXPORT_HEADERS, rows: data || [] };
}

function escCsv(val) {
  const s = String(val ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function escTsv(val) {
  return String(val ?? "")
    .replace(/\t/g, " ")
    .replace(/\r?\n/g, " ");
}

function buildCsv(headers, rows) {
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escCsv(r[h])).join(","));
  }
  return lines.join("\n");
}

function buildTsv(headers, rows) {
  const lines = [headers.join("\t")];
  for (const r of rows) {
    lines.push(headers.map((h) => escTsv(r[h])).join("\t"));
  }
  return lines.join("\n");
}

export async function exportForGoogleSheetsRemote(from, to) {
  const { headers, rows } = await fetchExportRows(from, to);
  if (!rows.length) throw new Error("No tickets in that date range.");

  const tsv = buildTsv(headers, rows);
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard not available. Use Download CSV instead.");
  }
  await navigator.clipboard.writeText(tsv);
  window.open("https://docs.google.com/spreadsheets/create", "_blank", "noopener,noreferrer");
  return { count: rows.length };
}

export async function downloadCsvRemote(from, to) {
  const { headers, rows } = await fetchExportRows(from, to);
  const blob = new Blob([buildCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ops-tickets-export.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}
