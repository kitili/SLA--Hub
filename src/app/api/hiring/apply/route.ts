import { NextResponse } from "next/server";
import { z } from "zod";

import { applicationDetailSchema, buildApplicationNotes } from "@/lib/hiring/application-fields";
import { ingestApplication } from "@/lib/hiring/pipeline";
import { parseRoleApplied } from "@/lib/hiring/roles";
import {
  enforceIpRateLimit,
  honeypotTripped,
  publicErrorMessage,
  securityLog,
  submittedTooFast,
  verifyTurnstile,
} from "@/lib/security";
import { env } from "@/lib/env";

const applySchema = z
  .object({
    fullName: z.string().trim().min(1).max(255),
    email: z.string().trim().min(3).max(254).refine((v) => v.includes("@")),
    preferredEmail: z.string().trim().max(254).optional(),
    linkedin: z.string().trim().max(2000).optional(),
    cvLink: z.string().trim().max(2000).optional(),
    roleApplied: z.string().trim().max(255).optional(),
    roleOther: z.string().trim().max(255).optional(),
    website: z.string().max(200).optional(),
    companyUrl: z.string().max(200).optional(),
    formStartedAt: z.coerce.number().optional(),
    turnstileToken: z.string().max(4000).optional(),
  })
  .merge(applicationDetailSchema)
  .strict();

/** Public apply endpoint — no HR login required. */
export async function POST(request: Request) {
  const limited = enforceIpRateLimit(request, "apply-handler", 8, 15 * 60_000);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const parsed = applySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid application" }, { status: 400 });
  }
  const data = parsed.data;

  if (honeypotTripped(data.website) || honeypotTripped(data.companyUrl)) {
    securityLog("bot.blocked", { reason: "honeypot" });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  if (submittedTooFast(data.formStartedAt)) {
    securityLog("bot.blocked", { reason: "too-fast" });
    return NextResponse.json({ error: "Please wait a moment and try again." }, { status: 400 });
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const turnstileOk = await verifyTurnstile(
    data.turnstileToken,
    env.TURNSTILE_SECRET_KEY,
    ip,
  );
  if (!turnstileOk) {
    securityLog("bot.blocked", { reason: "turnstile" });
    return NextResponse.json({ error: "Could not verify submission." }, { status: 400 });
  }

  const fullName = data.fullName;
  const email = data.email;
  const preferredEmail = data.preferredEmail || undefined;
  const linkedin = data.linkedin || undefined;
  const cvLink = data.cvLink || undefined;

  let roleApplied: string;
  try {
    roleApplied = parseRoleApplied({
      roleApplied: data.roleApplied || "",
      roleOther: data.roleOther || "",
    });
  } catch {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const notes = buildApplicationNotes(data, {
    source: "Hiring /apply form",
  });

  try {
    await ingestApplication({
      fullName,
      email,
      preferredEmail,
      linkedin,
      cvLink,
      roleApplied,
      notes,
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    securityLog("input.invalid", { route: "apply" });
    return NextResponse.json(
      { error: publicErrorMessage(err, "Could not submit application") },
      { status: 500 },
    );
  }
}
