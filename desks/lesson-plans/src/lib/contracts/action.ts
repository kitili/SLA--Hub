/**
 * Shared server-action result contract.
 *
 * Every server action returns `{ ok: boolean, ... }` with a machine-readable
 * `error` CODE (never raw exception text) on failure — the UI maps codes to
 * i18n messages. This generalises the pattern member.ts / feedback.ts
 * established; see docs/server-actions.md for the convention and a worked
 * example.
 *
 * Rules:
 *  - `error` is a short kebab-case code from a per-action union (default
 *    {@link ActionErrorCode}). It is safe to show as a fallback but is meant
 *    to be translated.
 *  - `message`, when present, is a deliberately AUTHORED safe string (e.g.
 *    joined validation issues) — never `err.message` from a caught exception.
 *    Raw errors are logged server-side via {@link actionFailure} instead.
 *  - Action data fields stay optional alongside `ok` (matching the
 *    long-standing `res.ok && res.data` consumer pattern).
 */

/** Default failure codes; actions may declare narrower/extra codes. */
export type ActionErrorCode = "invalid-input" | "not-found" | "conflict" | "failed";

/** Base result shape for server actions — extend with the action's data. */
export interface ActionResult<TCode extends string = ActionErrorCode> {
  ok: boolean;
  /** Failure code (present when `ok` is false) — map to an i18n message. */
  error?: TCode;
  /** Optional authored, user-safe detail (never raw exception text). */
  message?: string;
}

/**
 * Build a failure result. Logs `cause` server-side (the real error never
 * reaches the client) and optionally carries an authored `message`.
 */
export function actionFailure<TCode extends string>(
  code: TCode,
  opts?: { cause?: unknown; message?: string },
): { ok: false; error: TCode; message?: string } {
  if (opts?.cause !== undefined) {
    console.error(`[action:${code}]`, opts.cause);
  }
  return { ok: false, error: code, message: opts?.message };
}
