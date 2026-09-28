import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/constants";
import { sessionFromUser, signSession, verifyPassword } from "@/lib/auth";
import { homeFor } from "@/lib/roles";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");
  const user = await prisma.user.findUnique({ where: { email }, include: { campus: true } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  const session = sessionFromUser(user);
  if (!session) return NextResponse.json({ error: "Inactive" }, { status: 401 });
  const token = await signSession(session);
  const res = NextResponse.json({ ok: true, home: homeFor(session.role), role: session.role });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
