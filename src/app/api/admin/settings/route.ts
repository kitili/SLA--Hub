import { NextResponse } from "next/server";

import { getAllSettings, setSetting } from "@/lib/app-settings";
import { requireAdminApi } from "@/lib/hiring/require-admin-api";

const ALLOWED_SETTING_KEYS = new Set([
  "it_email",
  "hr_email",
  "culture_notify_email",
  "performance_dept_emails",
  "contact_phone_1",
  "contact_phone_2",
  "team_video_ceo",
  "team_video_hos",
  "team_video_hr",
  "team_video_dept",
]);

const PUBLIC_SETTING_KEYS = new Set(["performance_dept_emails"]);

export async function GET(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const settings = await getAllSettings();
  if (key) {
    if (!PUBLIC_SETTING_KEYS.has(key)) {
      return NextResponse.json({ error: "Unknown setting" }, { status: 400 });
    }
    return NextResponse.json({ value: settings[key] ?? "" });
  }
  const filtered = Object.fromEntries(
    Object.entries(settings).filter(([k]) => ALLOWED_SETTING_KEYS.has(k)),
  );
  return NextResponse.json({ settings: filtered });
}

export async function POST(request: Request) {
  const admin = await requireAdminApi();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.key !== "string" || typeof body.value !== "string") {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const key = body.key.trim();
  if (!ALLOWED_SETTING_KEYS.has(key)) {
    return NextResponse.json({ error: "Unknown setting" }, { status: 400 });
  }

  const maxLen = key === "performance_dept_emails" || key === "team_video_dept" ? 5000 : 500;
  await setSetting(key, body.value.trim().slice(0, maxLen));
  return NextResponse.json({ ok: true });
}
