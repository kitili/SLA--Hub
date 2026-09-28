/**
 * parseOrError — boundary helper for safe Zod parsing.
 *
 * Usage (server action or route handler):
 *
 *   const result = parseOrError(registerStaffSchema, rawInput);
 *   if (!result.ok) return result.error; // already shaped as ApiError
 *   const { email, fullName } = result.data;
 */

import { z } from "zod";
import type { ApiError } from "@/lib/contracts/api.js";

export type ParseOk<T> = { ok: true; data: T };
export type ParseFail = { ok: false; error: ApiError };
export type ParseResult<T> = ParseOk<T> | ParseFail;

/**
 * Synchronously parse `input` against `schema`.
 *
 * @returns `{ ok: true, data }` on success, or
 *          `{ ok: false, error: ApiError }` with per-field messages on failure.
 */
export function parseOrError<S extends z.ZodTypeAny>(
  schema: S,
  input: unknown
): ParseResult<z.output<S>> {
  const result = z.safeParse(schema, input);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  // Zod v4: ZodError has a .flatten() method returning { formErrors, fieldErrors }
  const flat = result.error.flatten();

  return {
    ok: false,
    error: {
      error: {
        code: "VALIDATION_ERROR",
        message:
          flat.formErrors[0] ?? "One or more fields failed validation.",
        fieldErrors: flat.fieldErrors as Record<string, string[]>,
      },
    },
  };
}
