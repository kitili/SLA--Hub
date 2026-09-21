/**
 * at-risk.ts — PURE, framework-free onboarding risk classification.
 *
 * Centralises the rule that decides whether a member is on-track ("green"),
 * slipping ("orange"), or off-track ("red") relative to where they *should* be
 * by now. No I/O, no imports, no clock access — `now` is injected so the
 * function is deterministic and trivially testable.
 *
 * Default rule (all thresholds are exported constants so they live in one
 * place):
 *
 *   expected = min(100, daysSinceStart / RAMP_DAYS * 100)
 *
 *   green   — actual ≥ expected − GREEN_BAND
 *   orange  — expected − ORANGE_BAND ≤ actual < expected − GREEN_BAND, OR
 *             no login for ≥ STALE_LOGIN_DAYS while still incomplete
 *   red     — actual < expected − ORANGE_BAND, OR
 *             daysSinceStart > RAMP_DAYS and still incomplete (overdue)
 *
 * `green` is the most forgiving and `red` the most severe; when several rules
 * apply the most severe wins.
 */

/** Risk classifications, ordered least → most severe. */
export type RiskLevel = "green" | "orange" | "red";

/** Number of days a member is expected to take to reach 100% (the ramp). */
export const RAMP_DAYS = 42;

/** Allowed shortfall (percentage points) before a member drops out of green. */
export const GREEN_BAND = 10;

/** Shortfall (percentage points) at/under which a member is red. */
export const ORANGE_BAND = 25;

/** Days without a login that flags an incomplete member as (at least) orange. */
export const STALE_LOGIN_DAYS = 7;

/** Milliseconds in a day — for converting timestamp deltas to whole days. */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Inputs for {@link riskLevel}. All time values are injected (no clock read). */
export interface RiskInput {
  /**
   * When the member started onboarding. `null`/`undefined` means they have not
   * started yet — there is no ramp to fall behind, so they are always green.
   */
  startedAt: Date | string | null | undefined;
  /** Current completion, 0–100. Values are clamped into range defensively. */
  completionPct: number;
  /** Last login / activity timestamp, or `null`/`undefined` if never seen. */
  lastActiveAt: Date | string | null | undefined;
  /** "Now" — injected so the calculation is deterministic. */
  now: Date | string | number;
}

/** Coerce a Date | string | number into epoch millis, or `null` if unusable. */
function toMillis(value: Date | string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Clamp `n` into the inclusive `[lo, hi]` range. */
function clamp(n: number, lo: number, hi: number): number {
  if (Number.isNaN(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/**
 * The completion a member is *expected* to have reached given how long ago they
 * started. Linear ramp from 0% on day 0 to 100% at {@link RAMP_DAYS}, capped at
 * 100. Exported for display ("expected vs actual") and testing.
 */
export function expectedCompletionPct(daysSinceStart: number): number {
  if (daysSinceStart <= 0) return 0;
  return Math.min(100, (daysSinceStart / RAMP_DAYS) * 100);
}

/**
 * Classify a member's onboarding risk. Pure — same inputs always yield the same
 * output. See module docstring for the rule.
 */
export function riskLevel(input: RiskInput): RiskLevel {
  const nowMs = toMillis(input.now) ?? Date.now();
  const startMs = toMillis(input.startedAt);

  // Not started yet → no ramp to be behind. Always on-track.
  if (startMs === null) return "green";

  const actual = clamp(input.completionPct, 0, 100);
  const complete = actual >= 100;

  const daysSinceStart = (nowMs - startMs) / MS_PER_DAY;
  const expected = expectedCompletionPct(daysSinceStart);
  const shortfall = expected - actual; // positive ⇒ behind schedule

  // ── RED (most severe) ────────────────────────────────────────────────────
  // Far behind the expected curve, or past the full ramp window and still
  // incomplete (overdue).
  if (!complete && daysSinceStart > RAMP_DAYS) return "red";
  if (shortfall > ORANGE_BAND) return "red";

  // ── ORANGE ───────────────────────────────────────────────────────────────
  // Moderately behind, or gone quiet (no login) while still incomplete.
  if (shortfall > GREEN_BAND) return "orange";

  if (!complete) {
    const lastActiveMs = toMillis(input.lastActiveAt);
    const daysSinceLogin =
      lastActiveMs === null ? Infinity : (nowMs - lastActiveMs) / MS_PER_DAY;
    if (daysSinceLogin >= STALE_LOGIN_DAYS) return "orange";
  }

  // ── GREEN ──────────────────────────────────────────────────────────────--
  return "green";
}
