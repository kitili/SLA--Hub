/**
 * Desk helpers: age/SLA, notify API, saved views, attachments, auth session.
 */

import { getSupabase, isConfigured, CAMPUSES } from "./api-remote.js";

const VIEWS_KEY = "ops_desk_saved_views";
const SLA_URGENT_HOURS = 4;

export function formatTicketAge(iso) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return mins <= 1 ? "1m" : mins + "m";
  const hours = Math.floor(mins / 60);
  if (hours < 48) return hours + "h";
  const days = Math.floor(hours / 24);
  return days + "d";
}

export function isSlaBreached(request, urgentHours = SLA_URGENT_HOURS) {
  const pri = request.priority || request.urgency || "normal";
  if (pri !== "urgent" && pri !== "high") return false;
  if (["closed", "declined", "resolved"].includes(request.status)) return false;
  const ms = Date.now() - new Date(request.created_at).getTime();
  return ms > urgentHours * 3600 * 1000;
}

export function ageClass(request) {
  if (isSlaBreached(request)) return "age-breach";
  const pri = request.priority || request.urgency;
  if (pri === "urgent") return "age-urgent";
  return "age-normal";
}

export function loadSavedViews() {
  try {
    const raw = localStorage.getItem(VIEWS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveSavedViews(list) {
  localStorage.setItem(VIEWS_KEY, JSON.stringify(list.slice(0, 12)));
}

export function upsertSavedView(view) {
  const list = loadSavedViews().filter((v) => v.name !== view.name);
  list.unshift({
    name: view.name,
    department: view.department || "",
    status: view.status || "",
    search: view.search || "",
    urgentOnly: Boolean(view.urgentOnly),
  });
  saveSavedViews(list);
  return list;
}

export function deleteSavedView(name) {
  const list = loadSavedViews().filter((v) => v.name !== name);
  saveSavedViews(list);
  return list;
}

/** Fire-and-forget status / campus notify via Next API. */
export async function notifyDesk(payload) {
  try {
    const headers = { "Content-Type": "application/json" };
    const secret =
      globalThis.__SL_ENV__?.DESK_NOTIFY_SECRET ||
      globalThis.__SL_ENV__?.CRON_SECRET ||
      "";
    if (secret) headers.Authorization = "Bearer " + secret;

    const res = await fetch("/api/ticketing/notify", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err.error || res.statusText };
    }
    return await res.json();
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "notify failed" };
  }
}

export async function listAttachments(requestId) {
  if (!isConfigured()) return [];
  try {
    const { data, error } = await getSupabase()
      .from("request_attachments")
      .select("*")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true });
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
}

export async function uploadAttachment(requestId, file, uploadedBy) {
  if (!isConfigured()) throw new Error("Supabase not configured.");
  if (!file) throw new Error("No file selected.");
  if (file.size > 5 * 1024 * 1024) throw new Error("Max file size is 5 MB.");

  const safe = String(file.name || "file")
    .replace(/[^\w.\-]+/g, "_")
    .slice(0, 80);
  const path = `${requestId}/${Date.now()}_${safe}`;
  const sb = getSupabase();

  const { error: upErr } = await sb.storage
    .from("desk-attachments")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (upErr) throw new Error(upErr.message);

  const { data: pub } = sb.storage.from("desk-attachments").getPublicUrl(path);
  const public_url = pub?.publicUrl || "";

  const row = {
    request_id: requestId,
    file_name: file.name || safe,
    mime_type: file.type || null,
    size_bytes: file.size,
    storage_path: path,
    public_url,
    uploaded_by: uploadedBy || "staff",
  };

  const { data, error } = await sb
    .from("request_attachments")
    .insert(row)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function ensureDeskAuth(role) {
  if (!isConfigured()) return null;
  try {
    const sb = getSupabase();
    const { data: existing } = await sb.auth.getSession();
    if (existing?.session?.user) return existing.session.user;

    if (role === "requester") {
      const { data, error } = await sb.auth.signInAnonymously();
      if (error) {
        // Anonymous auth may be disabled — soft fail
        console.warn("[desk] anonymous auth:", error.message);
        return null;
      }
      return data.user;
    }
    return null;
  } catch (e) {
    console.warn("[desk] auth:", e);
    return null;
  }
}

export async function signInDeskManager(email, password) {
  if (!isConfigured()) throw new Error("Supabase not configured.");
  const sb = getSupabase();
  const { data, error } = await sb.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new Error(error.message);
  return data.user;
}

export async function signOutDeskAuth() {
  if (!isConfigured()) return;
  try {
    await getSupabase().auth.signOut();
  } catch {
    /* ignore */
  }
}

export async function currentDeskUser() {
  if (!isConfigured()) return null;
  try {
    const { data } = await getSupabase().auth.getUser();
    return data.user || null;
  } catch {
    return null;
  }
}

export async function loadCampusLeads() {
  if (!isConfigured()) {
    return Object.fromEntries(CAMPUSES.map((c) => [c, { name: "", phone: "", email: "" }]));
  }
  try {
    const { data } = await getSupabase()
      .from("settings")
      .select("value")
      .eq("key", "campus_leads")
      .maybeSingle();
    return JSON.parse(data?.value || "{}");
  } catch {
    return {};
  }
}

export async function saveCampusLeads(leads) {
  const { error } = await getSupabase()
    .from("settings")
    .upsert({ key: "campus_leads", value: JSON.stringify(leads) }, { onConflict: "key" });
  if (error) throw new Error(error.message);
}

/* ——— In-app alerts (banner + bell) ——— */

const LOCAL_ALERTS_KEY = "ops_desk_local_alerts";

function localAlerts() {
  try {
    const raw = localStorage.getItem(LOCAL_ALERTS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeLocalAlerts(list) {
  localStorage.setItem(LOCAL_ALERTS_KEY, JSON.stringify(list.slice(0, 40)));
}

export function pushLocalAlert(alert) {
  const row = {
    id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
    ...alert,
    created_at: new Date().toISOString(),
    read_at: null,
  };
  const list = localAlerts();
  list.unshift(row);
  writeLocalAlerts(list);
  return row;
}

export async function createDeskAlert({
  audience = "manager",
  owner_token = null,
  request_id = null,
  display_id = null,
  kind = "info",
  title,
  body = "",
}) {
  const local = pushLocalAlert({
    audience,
    owner_token,
    request_id,
    display_id,
    kind,
    title,
    body,
  });

  if (!isConfigured()) return local;
  try {
    const { data, error } = await getSupabase()
      .from("desk_alerts")
      .insert({
        audience,
        owner_token,
        request_id,
        display_id,
        kind,
        title,
        body,
      })
      .select("*")
      .single();
    if (error) return local;
    return data;
  } catch {
    return local;
  }
}

export async function fetchDeskAlerts({ role, ownerToken }) {
  const local = localAlerts().filter((a) => {
    if (role === "manager") return a.audience === "manager" || a.audience === "all";
    return (
      a.audience === "requester" ||
      a.audience === "all" ||
      (ownerToken && a.owner_token === ownerToken)
    );
  });

  if (!isConfigured()) return local;

  try {
    let q = getSupabase()
      .from("desk_alerts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30);

    if (role === "manager") {
      q = q.in("audience", ["manager", "all"]);
    } else if (ownerToken) {
      q = q.or(
        `audience.eq.all,audience.eq.requester,owner_token.eq.${ownerToken}`
      );
    } else {
      q = q.in("audience", ["requester", "all"]);
    }

    const { data, error } = await q;
    if (error) return local;

    const remote = data || [];
    const seen = new Set(remote.map((r) => r.id));
    const merged = [...remote];
    for (const a of local) {
      if (!seen.has(a.id)) merged.push(a);
    }
    merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return merged.slice(0, 30);
  } catch {
    return local;
  }
}

export async function markAlertRead(id) {
  const list = localAlerts().map((a) =>
    a.id === id ? { ...a, read_at: new Date().toISOString() } : a
  );
  writeLocalAlerts(list);

  if (!isConfigured() || !id) return;
  try {
    await getSupabase()
      .from("desk_alerts")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
  } catch {
    /* ignore */
  }
}

export async function markAllAlertsRead(alerts) {
  const now = new Date().toISOString();
  writeLocalAlerts(localAlerts().map((a) => ({ ...a, read_at: a.read_at || now })));
  if (!isConfigured()) return;
  const ids = (alerts || []).filter((a) => !a.read_at).map((a) => a.id);
  if (!ids.length) return;
  try {
    await getSupabase().from("desk_alerts").update({ read_at: now }).in("id", ids);
  } catch {
    /* ignore */
  }
}

export function unreadCount(alerts) {
  return (alerts || []).filter((a) => !a.read_at).length;
}
