import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/admin";
import { getMessagingProvider } from "@/lib/messaging/provider";

export const runtime = "nodejs";

type NotifyBody = {
  kind?: "status" | "mention" | "campus_lead";
  requestId?: string;
  displayId?: string;
  title?: string;
  status?: string;
  department?: string;
  campus?: string;
  message?: string;
  phone?: string;
  actor?: string;
};

function deskSecretOk(req: Request) {
  const secret =
    process.env.DESK_NOTIFY_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const header = req.headers.get("x-desk-secret") || "";
  return bearer === secret || header === secret;
}

async function sendSms(to: string, message: string) {
  const provider = getMessagingProvider();
  const result = await provider.send({ to, body: message });
  return {
    sent: result.ok,
    stubbed: Boolean(result.stubbed) || provider.name === "stub",
    error: result.ok
      ? result.stubbed
        ? "stub"
        : undefined
      : result.error,
    provider: result.provider,
  };
}

export async function POST(req: Request) {
  if (!deskSecretOk(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: NotifyBody;
  try {
    body = (await req.json()) as NotifyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = body.kind || "status";
  const code = body.displayId || body.requestId || "ticket";
  const title = (body.title || "Ops ticket").slice(0, 80);
  const status = body.status || "";
  const dept = body.department || "";
  const campus = body.campus || "";
  const actor = body.actor || "Ops Desk";

  let text =
    body.message?.trim() ||
    `[Ops Desk] ${code} “${title}” → ${status || kind}` +
      (dept ? ` (${dept})` : "") +
      (campus ? ` @ ${campus}` : "") +
      ` — ${actor}`;
  text = text.slice(0, 460);

  const results: {
    target: string;
    sent: boolean;
    stubbed?: boolean;
    error?: string;
  }[] = [];

  try {
    const supabase = createServiceClient();
    const phones = new Set<string>();
    if (body.phone?.trim()) phones.add(body.phone.trim());

    if (kind === "status" || kind === "mention") {
      const { data: notifyOn } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "desk_notify_manager")
        .maybeSingle();
      if (!notifyOn || notifyOn.value !== "false") {
        const { data: phoneRow } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "ops_manager_phone")
          .maybeSingle();
        if (phoneRow?.value) phones.add(String(phoneRow.value).trim());
      }
    }

    if ((kind === "campus_lead" || kind === "mention") && campus) {
      const { data: leadsRow } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "campus_leads")
        .maybeSingle();
      try {
        const leads = JSON.parse(leadsRow?.value || "{}") as Record<
          string,
          { phone?: string }
        >;
        const lead = leads[campus];
        if (lead?.phone?.trim()) phones.add(lead.phone.trim());
      } catch {
        /* ignore */
      }
    }

    for (const phone of phones) {
      const res = await sendSms(phone, text);
      results.push({
        target: phone,
        sent: res.sent,
        stubbed: res.stubbed,
        error: res.error,
      });

      await supabase.from("message_logs").insert({
        parent_phone: phone,
        channel: res.stubbed ? "stub" : "sms",
        provider: res.provider || "desk",
        template_key: `desk_${kind}`,
        body: text,
        status: res.sent ? "sent" : "failed",
        error_message: res.error ?? null,
        sent_at: res.sent ? new Date().toISOString() : null,
      });
    }

    if (phones.size === 0) {
      const adminPhone = process.env.ADMIN_ALERT_PHONE?.trim();
      if (adminPhone) {
        const res = await sendSms(adminPhone, text);
        results.push({
          target: "ADMIN_ALERT_PHONE",
          sent: res.sent,
          stubbed: res.stubbed,
          error: res.error,
        });
      } else {
        results.push({
          target: "ADMIN_ALERT_PHONE",
          sent: false,
          stubbed: true,
          error: "ADMIN_ALERT_PHONE not set",
        });
      }
    }

    if (body.requestId) {
      await supabase.from("messages").insert({
        request_id: body.requestId,
        author_role: "manager",
        author_name: "Notify",
        body:
          "Notification (" +
          kind +
          "): " +
          (results.some((r) => r.sent || r.stubbed)
            ? "delivered/stubbed"
            : "no phone — check settings") +
          " — " +
          text.slice(0, 140),
      });
    }

    return NextResponse.json({
      ok: true,
      kind,
      results,
      notified: results.some((r) => r.sent || r.stubbed),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : "Notify failed",
        results,
      },
      { status: 500 },
    );
  }
}
