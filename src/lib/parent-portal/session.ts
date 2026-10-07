const TTL_MS = 8 * 60 * 60 * 1000;
const DEV_FALLBACK_SECRET = "dev-secret-change-me-in-production";

export type ParentSession = {
  parentIds: string[];
  iat: number;
  exp: number;
};

function cookieName() {
  return process.env.NODE_ENV === "development" ? "__sla_parent" : "__Host-sla_parent";
}

export function parentCookieName() {
  return cookieName();
}

export function parentCookieOptions() {
  return {
    httpOnly: true as const,
    secure: process.env.NODE_ENV !== "development",
    sameSite: "lax" as const,
    path: "/",
    maxAge: TTL_MS / 1000,
  };
}

function secret() {
  const value = process.env.SESSION_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is not set.");
  }
  return DEV_FALLBACK_SECRET;
}

async function signingKey() {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function encodeParentSession(parentIds: string[], now = Date.now()): Promise<string> {
  const payload: ParentSession = { parentIds, iat: now, exp: now + TTL_MS };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = Buffer.from(
    await crypto.subtle.sign("HMAC", await signingKey(), new TextEncoder().encode(json)),
  ).toString("base64url");
  return `${json}.${sig}`;
}

export async function decodeParentSession(raw: string | undefined | null): Promise<ParentSession | null> {
  if (!raw) return null;
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;
  const json = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    Buffer.from(sig, "base64url"),
    new TextEncoder().encode(json),
  );
  if (!valid) return null;
  try {
    const parsed = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as Partial<ParentSession>;
    const ids = parsed.parentIds;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 5 || ids.some((id) => typeof id !== "string" || !uuid.test(id))) {
      return null;
    }
    if (typeof parsed.exp !== "number" || Date.now() > parsed.exp) return null;
    return { parentIds: ids, iat: typeof parsed.iat === "number" ? parsed.iat : 0, exp: parsed.exp };
  } catch {
    return null;
  }
}
