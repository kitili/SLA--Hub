/**
 * Local-only convenience: skip the ed-admin gate and open the hub as the
 * seeded demo teacher. Hard-disabled in production.
 *
 *   GET http://localhost:3000/api/dev/local-login
 *   GET http://localhost:3000/api/dev/local-login?as=admin
 */
import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { upsertStaffByEmail } from "@/lib/db/repositories/staff";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const asAdmin = new URL(request.url).searchParams.get("as") === "admin";
  const edAdminStaffId = asAdmin ? "local-admin" : "local-demo";
  const member = await upsertStaffByEmail({
    email: asAdmin ? "hr@silverleaf.co.tz" : "teacher@silverleaf.co.tz",
    fullName: asAdmin ? "HR Admin" : "Test Teacher",
    campus: asAdmin ? "HQ" : "Main",
    jobTitle: asAdmin ? "HR" : "Teacher",
    isAdmin: asAdmin,
    edAdminStaffId,
  });

  await signIn(member.email, member.fullName ?? "Test Teacher", {
    jobTitle: member.jobTitle ?? "Teacher",
    edAdminStaffId: member.edAdminStaffId ?? edAdminStaffId,
  });

  const url = new URL(request.url);
  url.pathname = asAdmin ? "/en/admin" : "/en";
  url.search = "";
  if (url.hostname === "0.0.0.0") url.hostname = "localhost";
  return NextResponse.redirect(url);
}
