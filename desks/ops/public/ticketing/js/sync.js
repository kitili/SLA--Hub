/**
 * Flush outbox to Supabase when online.
 */

import { isOnline } from "./connectivity.js";
import { isConfigured } from "./api-remote.js";
import * as remote from "./api-remote.js";
import * as store from "./offline-store.js";

let _syncing = false;

export function isSyncing() {
  return _syncing;
}

export async function refreshPinCache() {
  if (!isOnline() || !isConfigured()) return;
  try {
    const { stored, salt } = await remote.fetchPinSettings();
    await store.cachePinSettings(salt, stored);
  } catch {
    /* ignore */
  }
}

async function processOutboxItem(item) {
  const requestId = await store.resolveId(item.requestId);

  switch (item.type) {
    case "create_request": {
      const body = item.payload;
      const localId = item.localId;
      const res = await remote.submitRequestRemote(body);
      const serverId = res.id;
      if (localId && localId !== serverId) {
        await store.setIdMapping(localId, serverId);
      }
      await store.putRequest({ ...res.row, _pending: false });
      return serverId;
    }
    case "patch_status":
      await remote.patchStatusRemote(requestId, item.payload);
      return requestId;
    case "assign":
      await remote.assignTicketRemote(requestId, item.payload);
      return requestId;
    case "post_message":
      await remote.postMessageRemote(requestId, item.payload);
      return requestId;
    case "mark_received":
      await remote.markReceivedRemote(requestId, item.payload);
      return requestId;
    case "reopen":
      await remote.reopenTicketRemote(requestId, item.payload);
      return requestId;
    default:
      throw new Error("Unknown outbox type: " + item.type);
  }
}

export async function syncNow() {
  if (!isOnline() || !isConfigured() || _syncing) {
    return { synced: 0, errors: [] };
  }

  _syncing = true;
  const errors = [];
  let synced = 0;

  try {
    await refreshPinCache();
    const items = await store.getOutbox();

    for (const item of items) {
      try {
        await processOutboxItem(item);
        await store.removeOutbox(item.id);
        synced++;
      } catch (err) {
        errors.push({ item, message: err.message });
      }
    }

    if (synced > 0 || items.length === 0) {
      try {
        const { requests } = await remote.listRequestsRemote({});
        await store.cacheRequests(requests.map((r) => ({ ...r, _pending: false })));
        await store.setMeta("last_sync", new Date().toISOString());
      } catch {
        /* partial sync ok */
      }
    }
  } finally {
    _syncing = false;
  }

  return { synced, errors };
}

export function startAutoSync(intervalMs = 45000) {
  if (typeof window === "undefined") return () => {};
  const run = () => {
    if (isOnline()) syncNow().catch(() => {});
  };
  window.addEventListener("online", run);
  const t = setInterval(run, intervalMs);
  run();
  return () => {
    window.removeEventListener("online", run);
    clearInterval(t);
  };
}
