import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { edadminConfigured } from "@/lib/edadmin/client";
import { syncEdadminDirectory } from "@/lib/edadmin/sync";

/** POST — pull Parents + Students from Ed-admin and upsert local roster + families. */
export async function POST() {
  await requireUser(["STORE", "FINANCE", "CEO"]);
  if (!edadminConfigured()) {
    return NextResponse.json(
      { error: "Ed-admin not configured. Set EDADMIN_BASE_URL and EDADMIN_GENERAL_API_KEY." },
      { status: 503 },
    );
  }
  const result = await syncEdadminDirectory(true);
  return NextResponse.json(result);
}
