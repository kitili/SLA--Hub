import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { buildParentSnapshot } from "@/lib/parent-snapshot";

export async function GET() {
  const user = await getSession();
  if (!user || user.role !== "PARENT") {
    return NextResponse.json({ error: "Not a parent session." }, { status: 401 });
  }
  const snapshot = await buildParentSnapshot(user.id, user.campusId ?? "", user.campusName, user.name);
  return NextResponse.json(snapshot);
}
