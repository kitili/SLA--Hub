import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const COOKIE = "d5_session";
const LEGACY_COOKIE = "d5_user";
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  return process.env.SESSION_SECRET || "silverleaf-tasks-dev";
}

function sign(userId: string, exp: number) {
  const body = `${userId}.${exp}`;
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function readUserId(token: string | undefined) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userId, expRaw, sig] = parts;
  const exp = Number(expRaw);
  if (!userId || !Number.isFinite(exp) || exp * 1000 < Date.now()) return null;
  const expected = createHmac("sha256", secret()).update(`${userId}.${expRaw}`).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

function cookieBase() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export async function getSessionUser() {
  const jar = await cookies();
  const id = readUserId(jar.get(COOKIE)?.value) ?? jar.get(LEGACY_COOKIE)?.value ?? null;
  if (!id) return null;

  return db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      phone: true,
      email: true,
      organizationId: true,
      role: true,
      jobTitle: true,
      bio: true,
      avatarUrl: true,
    },
  });
}

export async function setSession(userId: string) {
  const jar = await cookies();
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE;
  jar.set(COOKIE, sign(userId, exp), { ...cookieBase(), maxAge: MAX_AGE });
  jar.delete(LEGACY_COOKIE);
}

export async function clearSession() {
  const jar = await cookies();
  jar.set(COOKIE, "", { ...cookieBase(), maxAge: 0 });
  jar.set(LEGACY_COOKIE, "", { ...cookieBase(), maxAge: 0 });
}
