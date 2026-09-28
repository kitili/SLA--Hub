import { NextResponse } from "next/server";
import { getDefaultOrganization } from "@/lib/data/dashboard";
import { getOrganizationBoard } from "@/lib/data/board";

export async function GET() {
  const org = await getDefaultOrganization();
  if (!org) return NextResponse.json({ error: "No organization" }, { status: 404 });

  const data = await getOrganizationBoard(org.id);
  if (!data) return NextResponse.json({ error: "No organization" }, { status: 404 });

  return NextResponse.json(data);
}
