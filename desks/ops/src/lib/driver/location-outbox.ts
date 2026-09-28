/**
 * IndexedDB outbox for driver GPS pings — survives brief disconnects
 * (calls, tunnels, flaky mobile data) so live trail stays consistent.
 */

const DB_NAME = "sl-driver-outbox";
const STORE = "location_pings";
const DB_VERSION = 1;

export type QueuedLocationPing = {
  id?: number;
  tripId: string;
  lat: number;
  lng: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  capturedAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, {
          keyPath: "id",
          autoIncrement: true,
        });
        store.createIndex("tripId", "tripId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IDB open failed"));
  });
}

export async function enqueueLocationPing(
  ping: Omit<QueuedLocationPing, "id">,
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(ping);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Outbox is best-effort — never block the tracker.
  }
}

export async function listQueuedPings(
  tripId?: string,
): Promise<QueuedLocationPing[]> {
  try {
    const db = await openDb();
    const rows = await new Promise<QueuedLocationPing[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = tripId
        ? store.index("tripId").getAll(tripId)
        : store.getAll();
      req.onsuccess = () => resolve((req.result as QueuedLocationPing[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  } catch {
    return [];
  }
}

export async function removeQueuedPing(id: number): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}

/** Flush oldest-first; stops on first hard failure so order is preserved. */
export async function flushLocationOutbox(tripId: string): Promise<{
  sent: number;
  remaining: number;
}> {
  const queued = await listQueuedPings(tripId);
  let sent = 0;

  for (const ping of queued) {
    if (ping.id == null) continue;
    try {
      const res = await fetch(`/api/trips/${tripId}/locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: ping.lat,
          lng: ping.lng,
          accuracy: ping.accuracy,
          speed: ping.speed,
          heading: ping.heading,
        }),
      });
      if (!res.ok) break;
      await removeQueuedPing(ping.id);
      sent += 1;
    } catch {
      break;
    }
  }

  const remaining = (await listQueuedPings(tripId)).length;
  return { sent, remaining };
}
