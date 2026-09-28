import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api/require-user";
import { resolveStudentByQr } from "@/lib/db/queries";

export async function GET(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "finance", "driver"]);
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code")?.trim();

  if (!code) {
    return NextResponse.json(
      { error: "Query param `code` is required" },
      { status: 400 },
    );
  }

  const result = await resolveStudentByQr(code);
  if (!result) {
    return NextResponse.json({ error: "QR code not recognized" }, { status: 404 });
  }

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const auth = await requireUser(["admin", "transport", "matron", "finance", "driver"]);
  if ("response" in auth) return auth.response;

  const body = (await request.json()) as { code?: string };
  const code = body.code?.trim();

  if (!code) {
    return NextResponse.json({ error: "Field `code` is required" }, { status: 400 });
  }

  const result = await resolveStudentByQr(code);
  if (!result) {
    return NextResponse.json({ error: "QR code not recognized" }, { status: 404 });
  }

  return NextResponse.json(result);
}
