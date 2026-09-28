import { createHash, randomInt } from "node:crypto";

export function generateOtpCode(): string {
  // 100000–999999 guarantees exactly 6 digits, no leading-zero ambiguity.
  return String(randomInt(100000, 1000000));
}

export function hashOtpCode(code: string, email: string): string {
  const pepper = process.env["SESSION_SECRET"] ?? "";
  return createHash("sha256")
    .update(`${code.trim()}:${email.toLowerCase()}:${pepper}`)
    .digest("hex");
}
