import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/constants";
import { signSession, toSessionUser } from "@/lib/auth";
import { loginOrCreateByReg } from "@/lib/family";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await loginOrCreateByReg(String(body.regNo ?? ""));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const session = await toSessionUser(result.userId);
  if (!session) return NextResponse.json({ error: "Inactive" }, { status: 401 });
  const token = await signSession(session);
  const res = NextResponse.json({ ok: true, name: session.name, home: "/parent" });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
