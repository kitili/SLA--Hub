/**
 * IndexedDB cache + outbox for offline use.
 */

const DB_NAME = "silverleaf-ops-desk";
const DB_VERSION = 1;

let _db = null;

function openDb() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("requests")) {
        db.createObjectStore("requests", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("messages")) {
        const ms = db.createObjectStore("messages", { keyPath: "id", autoIncrement: true });
        ms.createIndex("request_id", "request_id", { unique: false });
      }
      if (!db.objectStoreNames.contains("outbox")) {
        db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
  });
}

function tx(store, mode = "readonly") {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        t.oncomplete = () => resolve(s);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

function promisify(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta(key) {
  const db = await openDb();
  return promisify(db.transaction("meta", "readonly").objectStore("meta").get(key));
}

export async function setMeta(key, value) {
  const db = await openDb();
  return promisify(
    db.transaction("meta", "readwrite").objectStore("meta").put({ key, value })
  );
}

export async function cachePinSettings(salt, hash) {
  if (salt) await setMeta("pin_salt", salt);
  if (hash) await setMeta("manager_pin_hash", hash);
}

export async function getCachedPinSettings() {
  const salt = await getMeta("pin_salt");
  const hash = await getMeta("manager_pin_hash");
  return {
    salt: salt?.value ?? null,
    hash: hash?.value ?? null,
  };
}

export async function putRequest(row) {
  const db = await openDb();
  return promisify(
    db.transaction("requests", "readwrite").objectStore("requests").put(row)
  );
}

export async function getRequest(id) {
  const db = await openDb();
  return promisify(db.transaction("requests", "readonly").objectStore("requests").get(id));
}

export async function getAllRequests() {
  const db = await openDb();
  return promisify(db.transaction("requests", "readonly").objectStore("requests").getAll());
}

export async function cacheRequests(rows) {
  const db = await openDb();
  const t = db.transaction("requests", "readwrite");
  const s = t.objectStore("requests");
  for (const row of rows) {
    s.put(row);
  }
  return new Promise((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function cacheMessagesForRequest(requestId, messages) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction("messages", "readwrite");
    const s = t.objectStore("messages");
    const idx = s.index("request_id");
    const req = idx.getAll(requestId);
    req.onsuccess = () => {
      for (const m of req.result || []) {
        if (m._local) s.delete(m.id);
      }
      for (const m of messages) {
        s.put({ ...m, request_id: requestId });
      }
    };
    req.onerror = () => reject(req.error);
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
  });
}

export async function getMessagesForRequest(requestId) {
  const db = await openDb();
  const idx = db.transaction("messages", "readonly").objectStore("messages").index("request_id");
  return promisify(idx.getAll(requestId));
}

export async function addLocalMessage(requestId, msg) {
  const db = await openDb();
  const row = {
    ...msg,
    request_id: requestId,
    _local: true,
    created_at_display: msg.created_at_display || "",
  };
  return promisify(
    db.transaction("messages", "readwrite").objectStore("messages").add(row)
  );
}

export async function addOutbox(item) {
  const db = await openDb();
  const row = { ...item, createdAt: item.createdAt || new Date().toISOString() };
  return promisify(db.transaction("outbox", "readwrite").objectStore("outbox").add(row));
}

export async function getOutbox() {
  const db = await openDb();
  const all = await promisify(db.transaction("outbox", "readonly").objectStore("outbox").getAll());
  return all.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export async function removeOutbox(id) {
  const db = await openDb();
  return promisify(db.transaction("outbox", "readwrite").objectStore("outbox").delete(id));
}

export async function outboxCount() {
  const items = await getOutbox();
  return items.length;
}

export async function setIdMapping(localId, serverId) {
  const maps = (await getMeta("id_map"))?.value || {};
  maps[localId] = serverId;
  await setMeta("id_map", maps);
}

export async function resolveId(id) {
  const maps = (await getMeta("id_map"))?.value || {};
  return maps[id] || id;
}

export function generateLocalRequestId() {
  const n = Math.random().toString(36).slice(2, 6).toUpperCase();
  return "REQ-L-" + Date.now().toString(36).toUpperCase() + "-" + n;
}
