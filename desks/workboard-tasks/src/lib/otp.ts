import { createHash, randomInt } from "node:crypto";

export function generateOtpCode(): string {
  const fixed = process.env.E2E_FIXED_OTP?.trim();
  if (process.env.NODE_ENV !== "production" && fixed && /^\d{6}$/.test(fixed)) {
    return fixed;
  }
  return String(randomInt(100000, 1000000));
}

export function hashOtpCode(code: string, email: string): string {
  const pepper = process.env.SESSION_SECRET ?? "";
  return createHash("sha256")
    .update(`${code.trim()}:${email.toLowerCase()}:${pepper}`)
    .digest("hex");
}
