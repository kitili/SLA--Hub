import "server-only";

import { NextResponse } from "next/server";

import { securityLog } from "@/lib/security/log";
import { secretsEqual } from "@/lib/security/secrets";

const MIN_KEY_LENGTH = 32;

function configuredKey() {
  return process.env.HUB_API_KEY?.trim() ?? "";
}

export function hubApiHeaders() {
  const origin = process.env.HUB_API_CORS_ORIGIN?.trim();
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
  }
  return headers;
}

export function hubApiJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: hubApiHeaders() });
}

export function hubApiOptions() {
  return new NextResponse(null, { status: 204, headers: hubApiHeaders() });
}

/** Returns a 401/503 response, or null when the Bearer key is valid. */
export function requireHubApiKey(request: Request): NextResponse | null {
  const key = configuredKey();
  if (!key || key.length < MIN_KEY_LENGTH) {
    securityLog("auth.denied", { gate: "hub-api", reason: "unconfigured" });
    return hubApiJson(
      { ok: false, error: "Hub API is not configured. Set HUB_API_KEY." },
      503,
    );
  }

  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !secretsEqual(token, key)) {
    securityLog("auth.denied", { gate: "hub-api" });
    return hubApiJson({ ok: false, error: "Unauthorized" }, 401);
  }
  return null;
}
