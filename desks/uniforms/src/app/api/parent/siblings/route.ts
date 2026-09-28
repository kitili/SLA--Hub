import { NextResponse } from "next/server";
import { getSession, setSessionCookie, toSessionUser } from "@/lib/auth";
import { addSiblingByReg } from "@/lib/family";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "PARENT") {
    return NextResponse.json({ error: "Not a parent session." }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const result = await addSiblingByReg(session.id, String(body.regNo ?? ""));
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const fresh = await toSessionUser(session.id);
  if (fresh) await setSessionCookie(fresh);
  return NextResponse.json(result);
}
