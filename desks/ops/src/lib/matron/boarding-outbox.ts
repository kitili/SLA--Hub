/**
 * IndexedDB outbox for matron boarding scans during brief offline
 * (phone call, tunnel, flaky data). Flushes in order when online.
 */

const DB_NAME = "sl-matron-boarding";
const STORE = "boarding_scans";
const DB_VERSION = 1;

export type QueuedBoarding = {
  id?: number;
  tripId: string;
  code: string;
  lat: number | null;
  lng: number | null;
  queuedAt: string;
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

export async function enqueueBoarding(
  row: Omit<QueuedBoarding, "id">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const code = row.code.trim().toLowerCase();
    const existing = await listQueuedBoardings(row.tripId);
    if (existing.some((e) => e.code.trim().toLowerCase() === code)) {
      return { ok: true };
    }
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).add(row);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Could not save offline scan",
    };
  }
}

export async function listQueuedBoardings(
  tripId?: string,
): Promise<QueuedBoarding[]> {
  try {
    const db = await openDb();
    const rows = await new Promise<QueuedBoarding[]>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const req = tripId
        ? store.index("tripId").getAll(tripId)
        : store.getAll();
      req.onsuccess = () => resolve((req.result as QueuedBoarding[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return rows.sort((a, b) => a.queuedAt.localeCompare(b.queuedAt));
  } catch {
    return [];
  }
}

export async function removeQueuedBoarding(id: number): Promise<void> {
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

export async function flushBoardingOutbox(tripId: string): Promise<{
  sent: number;
  remaining: number;
  lastError?: string;
}> {
  const queued = await listQueuedBoardings(tripId);
  let sent = 0;
  let lastError: string | undefined;

  for (const row of queued) {
    if (row.id == null) continue;
    try {
      const res = await fetch("/api/boarding", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: row.tripId,
          code: row.code,
          lat: row.lat,
          lng: row.lng,
          scannedAt: row.queuedAt,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        // Duplicate / already boarded — drop from queue (not retryable).
        const err = (data.error ?? "").toLowerCase();
        if (
          res.status === 409 ||
          err.includes("duplicate") ||
          err.includes("already")
        ) {
          await removeQueuedBoarding(row.id);
          sent += 1;
          continue;
        }
        lastError = data.error ?? "Boarding sync failed";
        break;
      }
      await removeQueuedBoarding(row.id);
      sent += 1;
    } catch {
      lastError = "Network error syncing boarding";
      break;
    }
  }

  const remaining = (await listQueuedBoardings(tripId)).length;
  return { sent, remaining, lastError };
}
