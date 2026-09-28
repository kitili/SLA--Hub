'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { isBrowserOffline, isNetworkError } from '@/lib/network';

const QUEUE_KEY = 'sla-offline-leads';
const LOOKUPS_KEY = 'sla-lead-lookups';
const LIST_CACHE_KEY = 'sla-leads-list-cache';
const QUEUE_EVENT = 'sla-offline-leads';
const SYNCED_EVENT = 'sla-offline-leads-synced';

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emitQueueChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(QUEUE_EVENT));
}

export function readOfflineLeadQueue() {
  if (typeof window === 'undefined') return [];
  try {
    const rows = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeOfflineLeadQueue(rows) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(rows));
  emitQueueChange();
}

export function listOfflineLeadsForUser(userId) {
  if (!userId) return readOfflineLeadQueue();
  return readOfflineLeadQueue().filter((row) => String(row.userId) === String(userId));
}

export function enqueueOfflineLead({ userId, payload }) {
  const item = {
    id: newId(),
    userId: userId || null,
    createdAt: new Date().toISOString(),
    status: 'pending',
    error: null,
    payload,
  };
  writeOfflineLeadQueue([...readOfflineLeadQueue(), item]);
  return item;
}

export function removeOfflineLead(id) {
  writeOfflineLeadQueue(readOfflineLeadQueue().filter((row) => row.id !== id));
}

function updateOfflineLead(id, patch) {
  writeOfflineLeadQueue(
    readOfflineLeadQueue().map((row) => (row.id === id ? { ...row, ...patch } : row))
  );
}

export function buildLeadCreatePayload(form, user) {
  return {
    ...form,
    campus_id: form.campus_id || user?.campusId || null,
    child_age: form.child_age === '' ? null : form.child_age,
    campaign_id: form.campaign_id || null,
    assigned_to: form.assigned_to || null,
    client_request_id: newId(),
  };
}

export function saveLeadLookups({ campuses, campaigns, campusHeads }) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOOKUPS_KEY, JSON.stringify({
    campuses: campuses || [],
    campaigns: campaigns || [],
    campusHeads: campusHeads || [],
    savedAt: Date.now(),
  }));
}

export function loadLeadLookups() {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(LOOKUPS_KEY) || 'null');
  } catch {
    return null;
  }
}

export function cacheLeadsList(userId, rows) {
  if (typeof window === 'undefined' || !userId) return;
  localStorage.setItem(LIST_CACHE_KEY, JSON.stringify({
    userId,
    rows: Array.isArray(rows) ? rows : [],
    savedAt: Date.now(),
  }));
}

export function loadLeadsList(userId) {
  if (typeof window === 'undefined' || !userId) return null;
  try {
    const cached = JSON.parse(localStorage.getItem(LIST_CACHE_KEY) || 'null');
    if (!cached || String(cached.userId) !== String(userId)) return null;
    return cached;
  } catch {
    return null;
  }
}

export function pendingLeadToRow(item, campuses = []) {
  const payload = item.payload || {};
  const campus = campuses.find((c) => String(c.id) === String(payload.campus_id));
  return {
    id: `offline:${item.id}`,
    offlineId: item.id,
    offlineStatus: item.status,
    offlineError: item.error,
    parent_name: payload.parent_name,
    parent_phone: payload.parent_phone,
    parent_phone2: payload.parent_phone2,
    parent_email: payload.parent_email,
    whatsapp_number: payload.whatsapp_number,
    child_name: payload.child_name,
    child_age: payload.child_age,
    child_gender: payload.child_gender,
    interested_class: payload.interested_class,
    boarding_day: payload.boarding_day,
    source: payload.source,
    how_heard: payload.how_heard,
    source_detail: payload.source_detail,
    occupation: payload.occupation,
    residence: payload.residence,
    region: payload.region,
    num_children: payload.num_children,
    intended_term: payload.intended_term,
    notes: payload.notes,
    campus_id: payload.campus_id,
    campus_name: campus?.name || '',
    assigned_to: payload.assigned_to,
    assigned_name: item.status === 'error' ? 'Sync failed' : 'On this device',
    created_by_name: 'On this device',
    computed_stage: 'interested_lead',
    lead_score: 0,
    created_at: item.createdAt,
    updated_at: item.createdAt,
    follow_up_date: payload.follow_up_date || null,
  };
}

async function alreadyOnServer(payload) {
  if (!payload?.parent_phone) return false;
  try {
    const res = await api.get('/marketing/leads', {
      params: { search: payload.parent_phone, limit: 50 },
      timeout: 20000,
    });
    const child = String(payload.child_name || '').trim().toLowerCase();
    return (res.data?.data || []).some((lead) => {
      const sameChild = String(lead.child_name || '').trim().toLowerCase() === child;
      const samePhone = String(lead.parent_phone || '') === String(payload.parent_phone || '');
      const age = Date.now() - new Date(lead.created_at).getTime();
      return sameChild && samePhone && Number.isFinite(age) && age < 48 * 60 * 60 * 1000;
    });
  } catch {
    return false;
  }
}

let syncLock = false;

export async function syncOfflineLeads(userId, { retryErrors = false } = {}) {
  if (syncLock) return { synced: 0, remaining: listOfflineLeadsForUser(userId).length };
  if (isBrowserOffline()) return { synced: 0, remaining: listOfflineLeadsForUser(userId).length };

  listOfflineLeadsForUser(userId)
    .filter((row) => row.status === 'syncing')
    .forEach((row) => updateOfflineLead(row.id, { status: 'pending', error: null }));

  const items = listOfflineLeadsForUser(userId).filter((row) => (
    row.status === 'pending' || (retryErrors && row.status === 'error')
  ));
  if (!items.length) return { synced: 0, remaining: 0 };

  syncLock = true;
  let synced = 0;
  try {
    for (const item of items) {
      updateOfflineLead(item.id, { status: 'syncing', error: null });
      try {
        if (await alreadyOnServer(item.payload)) {
          removeOfflineLead(item.id);
          synced += 1;
          continue;
        }
        await api.post('/marketing/leads', item.payload, { timeout: 30000 });
        removeOfflineLead(item.id);
        synced += 1;
      } catch (err) {
        if (isNetworkError(err) || err.response?.status === 401) {
          updateOfflineLead(item.id, { status: 'pending', error: null });
          break;
        }
        updateOfflineLead(item.id, {
          status: 'error',
          error: err.response?.data?.error || 'Could not sync this lead.',
        });
      }
    }
  } finally {
    syncLock = false;
    if (synced && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SYNCED_EVENT, { detail: { synced } }));
    }
  }
  return { synced, remaining: listOfflineLeadsForUser(userId).length };
}

export function useOfflineLeadQueue(userId) {
  const [items, setItems] = useState([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    function refresh() {
      setItems(listOfflineLeadsForUser(userId));
    }
    function onOnline() { setOnline(true); }
    function onOffline() { setOnline(false); }

    setOnline(!isBrowserOffline());
    refresh();
    window.addEventListener(QUEUE_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener(QUEUE_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [userId]);

  async function syncNow() {
    if (syncing) return { synced: 0, remaining: items.length };
    setSyncing(true);
    try {
      return await syncOfflineLeads(userId, { retryErrors: true });
    } finally {
      setSyncing(false);
    }
  }

  return {
    items,
    online,
    syncing,
    syncNow,
    discard: removeOfflineLead,
  };
}

export { QUEUE_EVENT, SYNCED_EVENT };
