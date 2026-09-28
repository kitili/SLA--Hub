// postgres-js wraps the driver's PostgresError inside drizzle's own "Failed query" Error,
// under `.cause` — the Postgres error code lives there, not on the outer error itself.
function pgErrorCode(error: unknown): string | undefined {
  if (!(error instanceof Error)) return undefined;
  return (error as { code?: string }).code ?? (error.cause as { code?: string } | undefined)?.code;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23503";
}

export function isUniqueViolation(error: unknown): boolean {
  return pgErrorCode(error) === "23505";
}
