import "server-only";

import { NextResponse } from "next/server";

import { publicErrorMessage } from "@/lib/security/http";

import { omitCandidateSecrets } from "./map-candidate";
import type { Candidate } from "./types";

export { parseUuidParam, UUID_RE } from "./ids";

export function invalidIdResponse() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function hiringErrorResponse(
  err: unknown,
  fallback: string,
  status = 400,
) {
  return NextResponse.json(
    { error: publicErrorMessage(err, fallback) },
    { status },
  );
}

/**
 * Fields the hiring admin UI actually reads from mutation responses.
 * Tokens and other secrets stay on the server.
 */
export function trimmedCandidate(candidate: Candidate) {
  const safe = omitCandidateSecrets(candidate);
  return {
    id: safe.id,
    stage: safe.stage,
    application_check: safe.application_check,
    work_email: safe.work_email,
    it_submitted_at: safe.it_submitted_at,
    welcome_email_sent_at: safe.welcome_email_sent_at,
  };
}
