// Column allowlist for embedding a user in a relational query result — excludes
// passwordHash and other account-security fields that must never reach an API response.
export const SAFE_USER_COLUMNS = { id: true, name: true, email: true, role: true } as const;
