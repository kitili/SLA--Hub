import { randomUUID } from "crypto";

export function newUploadToken() {
  return randomUUID();
}

export function buildUploadUrl(
  token: string,
  stage: "culture" | "performance",
  locale = "en",
) {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  return `${base}/${locale}/upload/${encodeURIComponent(token)}?stage=${stage}`;
}

export function newOnboardingToken() {
  return randomUUID();
}

export function buildOnboardingUrl(token: string, locale = "en") {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "http://localhost:3000";
  return `${base}/${locale}/hiring/onboarding/${encodeURIComponent(token)}`;
}
