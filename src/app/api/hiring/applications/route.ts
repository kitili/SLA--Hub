import { NextResponse } from "next/server";

import {
  mapApplicationPayload,
  missingApplicationRequirements,
} from "@/lib/hiring/application-payload";
import { ingestApplication } from "@/lib/hiring/pipeline";
import { publicErrorMessage } from "@/lib/security/http";
import { secretsEqual } from "@/lib/security/secrets";
import { securityLog } from "@/lib/security/log";

/**
 * Webhook for Google Forms / Sheets → new applications.
 * Header: Authorization: Bearer $APPLICATIONS_WEBHOOK_SECRET
 *
 * Required: full name + email (preferred email is accepted as the email).
 * Missing LinkedIn/CV still ingest as incomplete_application.
 */
export async function POST(request: Request) {
  const secret = process.env.APPLICATIONS_WEBHOOK_SECRET?.trim() ?? "";
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";

  if (
    !secret ||
    secret.includes("replace-with") ||
    !secretsEqual(token, secret)
  ) {
    securityLog("auth.denied", { gate: "applications-webhook" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  }

  const mapped = mapApplicationPayload(body as Record<string, unknown>);
  const missing = missingApplicationRequirements(mapped);
  if (missing.length) {
    securityLog("input.invalid", {
      route: "applications-webhook",
      missing: missing.join(","),
    });
    return NextResponse.json(
      { error: "fullName and email are required", missing },
      { status: 400 },
    );
  }

  try {
    const result = await ingestApplication({
      fullName: mapped.fullName!,
      email: mapped.email!,
      preferredEmail: mapped.preferredEmail,
      linkedin: mapped.linkedin,
      cvLink: mapped.cvLink,
      roleApplied: mapped.roleApplied || "General",
      notes: mapped.notes,
    });
    return NextResponse.json(
      { ok: true, id: result.candidate.id, duplicate: Boolean(result.duplicate) },
      { status: result.duplicate ? 200 : 201 },
    );
  } catch (err) {
    securityLog("input.invalid", { route: "applications-webhook" });
    return NextResponse.json(
      { error: publicErrorMessage(err, "Could not ingest application") },
      { status: 500 },
    );
  }
}
