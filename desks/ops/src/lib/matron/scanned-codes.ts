/** Per-trip, session-local "already scanned" set -- lets the camera reject a
 * repeat decode instantly, without waiting on a round-trip to the server. */

function scannedStorageKey(tripId: string) {
  return `matron-scanned:${tripId}`;
}

export function loadScannedCodes(tripId: string): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(scannedStorageKey(tripId));
    const list = JSON.parse(raw ?? "[]") as unknown;
    return new Set(
      Array.isArray(list)
        ? list.filter((c): c is string => typeof c === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

export function rememberScannedCode(tripId: string, code: string) {
  const next = loadScannedCodes(tripId);
  next.add(code.trim().toLowerCase());
  try {
    sessionStorage.setItem(scannedStorageKey(tripId), JSON.stringify([...next]));
  } catch {
    /* ignore quota */
  }
}

/** Re-syncs the local set from the server's actual scanned list (which
 * excludes voided scans) -- an overwrite, not a merge, so a scan that was
 * just voided drops out of the local dedup too and can be re-scanned. */
export async function refreshScannedCodesFromServer(tripId: string): Promise<void> {
  try {
    const res = await fetch(`/api/trips/${tripId}/scanned-codes`, {
      credentials: "include",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { codes?: string[] };
    const codes = (data.codes ?? []).map((c) => c.trim().toLowerCase());
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(scannedStorageKey(tripId), JSON.stringify(codes));
  } catch {
    /* ignore */
  }
}
