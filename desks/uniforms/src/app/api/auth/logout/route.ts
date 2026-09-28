import { NextResponse } from "next/server";
import { SESSION_COOKIE, SCHOOL_COOKIE } from "@/lib/constants";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  res.cookies.set(SCHOOL_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
