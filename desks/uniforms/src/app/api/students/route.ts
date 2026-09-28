import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { lookupStudent } from "@/actions/orders";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const regNo = url.searchParams.get("regNo") ?? "";
  const campusBound = session.role === "PARENT" || session.role === "ADMIN" || session.role === "HEAD_TEACHER" || session.role === "PRINCIPAL";
  const campusOnly = campusBound ? session.campusId : null;
  const student = await lookupStudent(regNo, campusOnly);
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(student);
}
