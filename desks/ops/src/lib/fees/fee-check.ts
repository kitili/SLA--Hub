export type FeeCheck = {
  status: "ok" | "stale" | "missing";
  note: string;
  age_hours: number | null;
};

const STALE_MS = 7 * 24 * 60 * 60 * 1000;

export function buildFeeCheck(fee: {
  synced_at?: string | null;
} | null | undefined): FeeCheck {
  const syncedAt = fee?.synced_at ?? null;
  if (!syncedAt) {
    return {
      status: "missing",
      note: "No fee sync timestamp — ask finance",
      age_hours: null,
    };
  }

  const syncedMs = Date.parse(syncedAt);
  if (!Number.isFinite(syncedMs)) {
    return {
      status: "missing",
      note: "No fee sync timestamp — ask finance",
      age_hours: null,
    };
  }

  const ageMs = Math.max(0, Date.now() - syncedMs);
  const age_hours = Math.round((ageMs / (60 * 60 * 1000)) * 10) / 10;

  if (ageMs > STALE_MS) {
    return {
      status: "stale",
      note: "Fee ledger may be stale — confirm with finance",
      age_hours,
    };
  }

  const ageDays = ageMs / (24 * 60 * 60 * 1000);
  const freshness =
    ageDays < 1
      ? "synced today"
      : ageDays < 2
        ? "synced yesterday"
        : `synced ${Math.floor(ageDays)} days ago`;

  return {
    status: "ok",
    note: `Matches fee ledger · ${freshness}`,
    age_hours,
  };
}

/** True when fee_synced_at exists and is older than 7 days. */
export function isFeeSyncStale(syncedAt: string | null | undefined): boolean {
  if (!syncedAt) return false;
  const syncedMs = Date.parse(syncedAt);
  if (!Number.isFinite(syncedMs)) return false;
  return Date.now() - syncedMs > STALE_MS;
}
