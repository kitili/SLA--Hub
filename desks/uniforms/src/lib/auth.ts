import type { Campus, User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify, SignJWT } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE, sessionIssuedWithinTtl, type Role } from "./constants";
import { canOpenPath, homeFor } from "./roles";

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET ?? "silverleaf-dev-secret-change-me");

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  campusId: string | null;
  campusCode: string | null;
  campusName: string | null;
  familyId: string | null;
};

function secret() {
  return JWT_SECRET;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    campusId: user.campusId,
    campusCode: user.campusCode,
    campusName: user.campusName,
    familyId: user.familyId,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function readSessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!sessionIssuedWithinTtl(payload.iat)) return null;
    return {
      id: String(payload.sub ?? ""),
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: payload.role as Role,
      campusId: (payload.campusId as string | null) ?? null,
      campusCode: (payload.campusCode as string | null) ?? null,
      campusName: (payload.campusName as string | null) ?? null,
      familyId: (payload.familyId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return readSessionToken(token);
}

export async function setSessionCookie(user: SessionUser) {
  const token = await signSession(user);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

export function sessionFromUser(user: User & { campus?: Campus | null }): SessionUser | null {
  if (!user.active) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as Role,
    campusId: user.campusId,
    campusCode: user.campus?.code ?? null,
    campusName: user.campus?.name ?? null,
    familyId: user.familyId,
  };
}

export async function toSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { campus: true },
  });
  if (!user) return null;
  return sessionFromUser(user);
}

export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (roles && !roles.includes(session.role)) {
    redirect(homeFor(session.role));
  }
  return session;
}

export async function requirePath(pathname: string): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canOpenPath(session.role, pathname)) {
    redirect(homeFor(session.role));
  }
  return session;
}
