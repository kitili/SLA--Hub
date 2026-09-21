/**
 * Generic API response envelopes.
 *
 * Every route handler and server action that can fail should return one of
 * these shapes so clients have a consistent error structure to handle.
 */

/** Structured error returned by route handlers / server actions. */
export interface ApiError {
  error: {
    /** Machine-readable error code, e.g. "VALIDATION_ERROR", "NOT_FOUND" */
    code: string;
    /** Human-readable summary (not necessarily shown verbatim to users) */
    message: string;
    /** Per-field validation messages, present when code === "VALIDATION_ERROR" */
    fieldErrors?: Record<string, string[]>;
  };
}

/** Successful API response wrapper — keeps the shape consistent. */
export interface ApiSuccess<T> {
  data: T;
}

/** Union of all possible API response shapes */
export type ApiResult<T> = ApiSuccess<T> | ApiError;

/** Type-guard: true when the response is an error */
export function isApiError(result: unknown): result is ApiError {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof (result as ApiError).error?.code === "string"
  );
}
