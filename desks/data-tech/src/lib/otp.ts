import { randomInt } from "crypto";
import bcrypt from "bcryptjs";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { users, loginOtpCodes } from "@/db/schema";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email/send-email";
import { loginOtpEmail } from "@/lib/email/templates/login-otp";

export const OTP_TTL_MINUTES = 10;
// Same purpose as the DUMMY_HASH in auth.ts — a bcrypt.compare() that always runs so a
// nonexistent/inactive account takes the same time as a real one.
const DUMMY_HASH = "$2b$12$CwG9k0pQe1xO8m2r9J1fbeC0V1qk8m2r9J1fbeC0V1qk8m2r9J1fb";

// Always resolves — never reveals whether the email belongs to an account. Callers should
// show the same "if that email exists, a code was sent" message regardless of the outcome.
export async function requestOtpCode(rawEmail: string) {
  const email = rawEmail.toLowerCase().trim();
  if (!email) return;

  const rateLimit = await checkRateLimit(`otp-send:${email}`, 5, 15 * 60);
  if (!rateLimit.allowed) return;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !user.isActive) {
    await bcrypt.compare("x", DUMMY_HASH);
    return;
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 12);

  await db.transaction(async (tx) => {
    // Only one active code per user at a time.
    await tx.delete(loginOtpCodes).where(and(eq(loginOtpCodes.userId, user.id), isNull(loginOtpCodes.usedAt)));
    await tx.insert(loginOtpCodes).values({
      userId: user.id,
      codeHash,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });
  });

  const { subject, html } = loginOtpEmail(code);
  await sendEmail({ to: user.email, subject, html }).catch(() => {});
}
